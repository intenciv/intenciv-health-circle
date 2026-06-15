/**
 * Auth routes — public.
 *
 *   POST /auth/admin/login                { email, password }   → tokens
 *   POST /auth/reception/login            { email, password }   → tokens
 *   POST /auth/salesperson/login          { phone, pin }        → tokens
 *   POST /auth/customer/login             { phone }             → tokens (no OTP, legacy)
 *   POST /auth/customer/send-otp          { phone }             → sends OTP via Authkey
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

// ── ADMIN ────────────────────────────────────────────────────────────────────
router.post(
  '/admin/login',
  body('email').isEmail(),
  body('password').isString().isLength({ min: 6 }),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return bail(res, errors);
    try {
      const [rows] = await pool.execute(
        `SELECT id, role, email, full_name, password_hash, is_active
           FROM users WHERE email = ? AND role = 'admin' LIMIT 1`,
        [req.body.email.toLowerCase().trim()]
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
router.post(
  '/reception/login',
  body('email').isEmail(),
  body('password').isString().isLength({ min: 6 }),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return bail(res, errors);
    try {
      const [rows] = await pool.execute(
        `SELECT id, role, email, full_name, password_hash, is_active
           FROM users WHERE email = ? AND role = 'reception' LIMIT 1`,
        [req.body.email.toLowerCase().trim()]
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

// ── SALESPERSON ───────────────────────────────────────────────────────────────
router.post(
  '/salesperson/login',
  body('phone').isString().notEmpty(),
  body('pin').isString().isLength({ min: 4, max: 4 }),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return bail(res, errors);
    try {
      const phone = normalisePhone(req.body.phone);
      if (!phone) return res.status(400).json({ error: 'invalid_phone' });

      const [rows] = await pool.execute(
        `SELECT id, role, phone, full_name, pin_hash, is_active
           FROM users WHERE phone = ? AND role = 'salesperson' LIMIT 1`,
        [phone]
      );
      if (rows.length === 0 || !rows[0].is_active)
        return res.status(401).json({ error: 'invalid_credentials' });
      const ok = await verifyPin(req.body.pin, rows[0].pin_hash);
      if (!ok) return res.status(401).json({ error: 'invalid_credentials' });

      await pool.execute('UPDATE users SET last_login = NOW() WHERE id = ?', [rows[0].id]);
      const { pin_hash, ...user } = rows[0];
      res.json({ access_token: signAccess(user), refresh_token: signRefresh(user), user });
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
          WHERE u.phone = ? AND u.role = 'customer' AND u.is_active = 1
          LIMIT 1`,
        [phone]
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
          WHERE phone = ? AND role = 'customer' AND is_active = 1 LIMIT 1`,
        [phone]
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
           FROM users WHERE phone = ? AND role = 'customer' LIMIT 1`,
        [phone]
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
