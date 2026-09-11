/**
 * Auth routes — public.
 *
 *   POST /auth/admin/login                { employee_id, password } → tokens
 *   POST /auth/reception/login            { employee_id, password } → tokens
 *   POST /auth/salesperson/login          { employee_id, password } → tokens
 *                                         (or legacy { phone, pin })
 *   POST /auth/customer/login             { phone }             → tokens (no OTP, legacy)
 *   POST /auth/customer/send-otp          { phone }             → sends OTP via Datagen
 *   POST /auth/customer/verify-otp        { phone, otp }        → tokens
 *   POST /auth/refresh-token              { refresh_token }     → access token
 */
const express  = require('express');
const crypto   = require('crypto');
const { body, validationResult } = require('express-validator');

const { pool }                    = require('../config/db');
const { signAccess, signRefresh, verify } = require('../utils/jwt');
const { verifyPassword, verifyPin }       = require('../utils/passwords');
const { sendOTP }                         = require('../utils/otp');

const router = express.Router();

// ── Google Play reviewer bypass ─────────────────────────────────────────────
// A dedicated test account so Play reviewers can log in without a real SMS
// OTP. Inactive unless BOTH env vars are set — no accidental backdoor.
// The phone still needs an actual 'customer' row with an active card
// (seeded via scripts/seed-play-reviewer.js); this only replaces the random
// OTP + real SMS send with a fixed, reusable one for that single number.
const REVIEWER_PHONE = process.env.PLAY_REVIEWER_PHONE || null;
const REVIEWER_OTP   = process.env.PLAY_REVIEWER_OTP   || null;


function bail(res, errors) {
  return res.status(400).json({ error: 'validation_failed', details: errors.array() });
}

function normalisePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 10)                            return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (digits.length === 13 && digits.startsWith('091'))return `+${digits.slice(1)}`;
  return null;
}

/**
 * The users table is not consistent about phone format: most rows are
 * +91XXXXXXXXXX but some were written as a bare 10-digit number, and those
 * could never match a normalised lookup — that customer got
 * mobile_not_registered forever. Lookups therefore match both spellings.
 * Anything written by this file still uses the normalised (+91) form.
 */
function phoneVariants(normalised) {
  const local = String(normalised).slice(-10);
  return [normalised, local];
}

// ── ADMIN ────────────────────────────────────────────────────────────────────
router.post(
  '/admin/login',
  body('employee_id').isString().notEmpty(),
  body('password').isString().isLength({ min: 6 }),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return bail(res, errors);
    try {
      const [rows] = await pool.execute(
        `SELECT id, role, employee_id, email, full_name, password_hash, is_active
           FROM users WHERE employee_id = ? AND role = 'admin' LIMIT 1`,
        [req.body.employee_id.trim().toUpperCase()]
      );
      if (rows.length === 0 || !rows[0].is_active)
        return res.status(401).json({ error: 'invalid_credentials' });
      const ok = await verifyPassword(req.body.password, rows[0].password_hash);
      if (!ok) return res.status(401).json({ error: 'invalid_credentials' });

      await pool.execute('UPDATE users SET last_login = NOW() WHERE id = ?', [rows[0].id]);
      const { password_hash, ...user } = rows[0];
      res.json({ access_token: signAccess(user), refresh_token: signRefresh(user), user });
    } catch (e) { next(e); }
  }
);

// ── RECEPTION ─────────────────────────────────────────────────────────────────
// Accepts an Employee ID *or* an email address in the same field.
//
// Reception accounts predate the Employee ID login model: they were created
// by hand in SQL on 2026-06-22, back when this route authenticated on email
// (commit ca0a60b), and there has never been an endpoint or admin screen that
// creates a reception user — so nothing ever required an employee_id of them.
// When login moved to employee_id, migration 006 was supposed to backfill one,
// but it was never run in production, leaving both accounts with
// employee_id IS NULL and therefore unable to match a lookup keyed on it: a
// permanent 401 that looks exactly like a wrong password.
//
// Matching either identifier lets those accounts sign in with the credentials
// they already have, and keeps working once employee_ids are assigned.
router.post(
  '/reception/login',
  body('employee_id').isString().notEmpty(),
  body('password').isString().isLength({ min: 6 }),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return bail(res, errors);
    try {
      const identifier = req.body.employee_id.trim();
      const [rows] = await pool.execute(
        `SELECT id, role, employee_id, email, full_name, password_hash, is_active
           FROM users
          WHERE role = 'reception' AND (employee_id = ? OR email = ?)
          LIMIT 1`,
        [identifier.toUpperCase(), identifier.toLowerCase()]
      );
      if (rows.length === 0 || !rows[0].is_active || !rows[0].password_hash)
        return res.status(401).json({ error: 'invalid_credentials' });
      const ok = await verifyPassword(req.body.password, rows[0].password_hash);
      if (!ok) return res.status(401).json({ error: 'invalid_credentials' });

      await pool.execute('UPDATE users SET last_login = NOW() WHERE id = ?', [rows[0].id]);
      const { password_hash, ...user } = rows[0];
      res.json({ access_token: signAccess(user), refresh_token: signRefresh(user), user });
    } catch (e) { next(e); }
  }
);

// ── SALESPERSON ───────────────────────────────────────────────────────────────
// Accepts two shapes. The web panel signs all three panel roles in with
// Employee ID + password (web-panel/src/pages/Login.jsx, migration 006), which
// is why a phone+PIN-only route rejected every salesperson login from the
// panel before reaching the credential check. The older phone + 4-digit PIN
// shape is still honoured so any client still sending it keeps working.
//
// The 4-digit PIN remains the authorisation for each card activation in the
// field (see routes/salesperson.js) — a separate control from signing in.
router.post(
  '/salesperson/login',
  async (req, res, next) => {
    try {
      const { employee_id, password, phone: rawPhone, pin } = req.body || {};

      if (employee_id && password) {
        const [rows] = await pool.execute(
          `SELECT id, role, employee_id, phone, full_name, password_hash, is_active
             FROM users WHERE employee_id = ? AND role = 'salesperson' LIMIT 1`,
          [String(employee_id).trim().toUpperCase()]
        );
        if (rows.length === 0 || !rows[0].is_active || !rows[0].password_hash)
          return res.status(401).json({ error: 'invalid_credentials' });
        const ok = await verifyPassword(password, rows[0].password_hash);
        if (!ok) return res.status(401).json({ error: 'invalid_credentials' });

        await pool.execute('UPDATE users SET last_login = NOW() WHERE id = ?', [rows[0].id]);
        const { password_hash, ...user } = rows[0];
        return res.json({ access_token: signAccess(user), refresh_token: signRefresh(user), user });
      }

      if (rawPhone && pin) {
        const phone = normalisePhone(rawPhone);
        if (!phone) return res.status(400).json({ error: 'invalid_phone' });

        const [rows] = await pool.execute(
          `SELECT id, role, phone, full_name, pin_hash, is_active
             FROM users WHERE phone IN (?, ?) AND role = 'salesperson' LIMIT 1`,
          phoneVariants(phone)
        );
        if (rows.length === 0 || !rows[0].is_active)
          return res.status(401).json({ error: 'invalid_credentials' });
        const ok = await verifyPin(pin, rows[0].pin_hash);
        if (!ok) return res.status(401).json({ error: 'invalid_credentials' });

        await pool.execute('UPDATE users SET last_login = NOW() WHERE id = ?', [rows[0].id]);
        const { pin_hash, ...user } = rows[0];
        return res.json({ access_token: signAccess(user), refresh_token: signRefresh(user), user });
      }

      return res.status(400).json({
        error: 'validation_failed',
        message: 'Provide employee_id + password, or phone + pin.',
      });
    } catch (e) { next(e); }
  }
);

// ── CUSTOMER: legacy direct login (no OTP) ────────────────────────────────────
router.post(
  '/customer/login',
  body('phone').isString().notEmpty(),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return bail(res, errors);
    try {
      const phone = normalisePhone(req.body.phone);
      if (!phone) return res.status(400).json({ error: 'invalid_phone' });

      const [rows] = await pool.execute(
        `SELECT u.id, u.role, u.phone, u.full_name, u.is_active
           FROM users u
          WHERE u.phone IN (?, ?) AND u.role = 'customer' AND u.is_active = 1
          LIMIT 1`,
        phoneVariants(phone)
      );
      if (rows.length === 0) {
        return res.status(404).json({
          error: 'mobile_not_registered',
          message: 'This number is not linked to any membership. Please contact your sales representative.',
        });
      }
      const [cards] = await pool.execute(
        `SELECT id FROM cards WHERE customer_id = ? AND status = 'active' LIMIT 1`,
        [rows[0].id]
      );
      if (cards.length === 0) {
        return res.status(403).json({ error: 'no_active_membership', message: 'No active membership found.' });
      }
      await pool.execute('UPDATE users SET last_login = NOW() WHERE id = ?', [rows[0].id]);
      res.json({ access_token: signAccess(rows[0]), refresh_token: signRefresh(rows[0]), user: rows[0] });
    } catch (e) { next(e); }
  }
);

// ── CUSTOMER: Send OTP ────────────────────────────────────────────────────────
router.post(
  '/customer/send-otp',
  body('phone').isString().notEmpty(),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return bail(res, errors);
    try {
      const phone = normalisePhone(req.body.phone);
      if (!phone) return res.status(400).json({ error: 'invalid_phone' });

      // Check registered active customer
      const [rows] = await pool.execute(
        `SELECT id FROM users
          WHERE phone IN (?, ?) AND role = 'customer' AND is_active = 1 LIMIT 1`,
        phoneVariants(phone)
      );
      if (rows.length === 0) {
        return res.status(404).json({
          error: 'mobile_not_registered',
          message: 'This number is not linked to any membership. Please contact your sales representative.',
        });
      }

      // Check active card exists
      const [cards] = await pool.execute(
        `SELECT id FROM cards WHERE customer_id = ? AND status = 'active' LIMIT 1`,
        [rows[0].id]
      );
      if (cards.length === 0) {
        return res.status(403).json({ error: 'no_active_membership', message: 'No active membership found.' });
      }

      // Google Play reviewer: fixed, reusable OTP, no real SMS sent.
      if (REVIEWER_PHONE && REVIEWER_OTP && phone === REVIEWER_PHONE) {
        const otpHash = crypto.createHash('sha256').update(REVIEWER_OTP).digest('hex');
        const expires = new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000); // ~10 years
        await pool.execute(
          `INSERT INTO otp_log (phone, otp_hash, purpose, expires_at, is_verified, attempts)
           VALUES (?, ?, 'activation', ?, 0, 0)
           ON DUPLICATE KEY UPDATE
             otp_hash    = VALUES(otp_hash),
             expires_at  = VALUES(expires_at),
             is_verified = 0,
             attempts    = 0`,
          [phone, otpHash, expires]
        );
        return res.json({ ok: true, message: 'OTP sent successfully' });
      }

      // Generate OTP + hash
      const otp     = Math.floor(100000 + Math.random() * 900000).toString();
      const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
      const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 min

      await pool.execute(
        `INSERT INTO otp_log (phone, otp_hash, purpose, expires_at, is_verified, attempts)
         VALUES (?, ?, 'customer_login', ?, 0, 0)
         ON DUPLICATE KEY UPDATE
           otp_hash   = VALUES(otp_hash),
           expires_at = VALUES(expires_at),
           is_verified = 0,
           attempts   = 0`,
        [phone, otpHash, expires]
      );

      await sendOTP(phone, otp);
      res.json({ ok: true, message: 'OTP sent successfully' });
    } catch (e) { next(e); }
  }
);

// ── CUSTOMER: Verify OTP ──────────────────────────────────────────────────────
router.post(
  '/customer/verify-otp',
  body('phone').isString().notEmpty(),
  body('otp').isString().isLength({ min: 6, max: 6 }),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return bail(res, errors);
    try {
      const phone = normalisePhone(req.body.phone);
      if (!phone) return res.status(400).json({ error: 'invalid_phone' });

      const otpHash = crypto.createHash('sha256').update(req.body.otp).digest('hex');

      const [otpRows] = await pool.execute(
        `SELECT id FROM otp_log
          WHERE phone = ? AND otp_hash = ? AND expires_at > NOW() AND is_verified = 0
          LIMIT 1`,
        [phone, otpHash]
      );
      if (otpRows.length === 0) {
        return res.status(401).json({ error: 'invalid_otp', message: 'OTP is incorrect or expired.' });
      }

      await pool.execute(
        `UPDATE otp_log SET is_verified = 1 WHERE id = ?`,
        [otpRows[0].id]
      );

      const [users] = await pool.execute(
        `SELECT id, role, phone, full_name, is_active
           FROM users WHERE phone IN (?, ?) AND role = 'customer' LIMIT 1`,
        phoneVariants(phone)
      );
      if (users.length === 0) return res.status(404).json({ error: 'user_not_found' });

      await pool.execute('UPDATE users SET last_login = NOW() WHERE id = ?', [users[0].id]);
      res.json({
        access_token:  signAccess(users[0]),
        refresh_token: signRefresh(users[0]),
        user:          users[0],
      });
    } catch (e) { next(e); }
  }
);

// ── REFRESH TOKEN ─────────────────────────────────────────────────────────────
router.post(
  '/refresh-token',
  body('refresh_token').isString().notEmpty(),
  async (req, res) => {
    try {
      const decoded = verify(req.body.refresh_token);
      if (decoded.type !== 'refresh') return res.status(401).json({ error: 'invalid_token_type' });
      const [rows] = await pool.execute(
        'SELECT id, role, is_active FROM users WHERE id = ? LIMIT 1', [decoded.id]
      );
      if (rows.length === 0 || !rows[0].is_active)
        return res.status(401).json({ error: 'account_unavailable' });
      res.json({ access_token: signAccess(rows[0]) });
    } catch (_e) {
      return res.status(401).json({ error: 'invalid_or_expired_refresh' });
    }
  }
);

module.exports = router;
