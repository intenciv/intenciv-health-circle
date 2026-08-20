/**
 * Auth routes — public.
 *
 *   POST /auth/admin/login                { email, password }   → tokens
 *   POST /auth/reception/login            { email, password }   → tokens
 *   POST /auth/salesperson/login          { phone, pin }        → tokens
 *   POST /auth/customer/send-otp          { phone }             → sends OTP via Authkey 2FA
 *   POST /auth/customer/verify-otp        { phone, otp }        → tokens
 *   POST /auth/refresh-token              { refresh_token }     → access token
 *
 * The previous direct-login endpoint (POST /auth/customer/login, phone
 * only, no OTP) has been removed entirely — confirmed directly: "no OTP
 * verification is there.. To make secure, one should login after
 * verifying the OTP." Removed rather than just stopped-calling-from-the-
 * app, since a live insecure endpoint is a real liability even if the
 * app itself no longer uses it — anyone who knew a registered customer's
 * phone number could call it directly (e.g. via curl) and get a valid
 * session for that customer's account, bypassing the app entirely.
 */
const express  = require('express');
const { v4: uuidv4 } = require('uuid');
const { body, validationResult } = require('express-validator');

const { pool }                    = require('../config/db');
const { signAccess, signRefresh, verify } = require('../utils/jwt');
const { verifyPassword, verifyPin }       = require('../utils/passwords');
const authkey                             = require('../services/authkey');

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

// ── CUSTOMER: Send OTP (Authkey 2FA API — Authkey generates and owns the
//    OTP itself; we store the LogID it returns and verify against that,
//    never a locally-generated/hashed code) ────────────────────────────
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

      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

      const gw = await authkey.sendOtp({ phone });
      if (!gw || !gw.LogID) {
        return res.status(502).json({ error: 'otp_gateway_failed', details: gw });
      }

      await pool.execute(
        `UPDATE otp_log SET is_verified = 1 WHERE phone = ? AND purpose = 'customer_login' AND is_verified = 0`,
        [phone]
      );
      await pool.execute(
        `INSERT INTO otp_log (id, phone, otp_hash, log_id, purpose, expires_at)
         VALUES (?, ?, '', ?, 'customer_login', ?)`,
        [uuidv4(), phone, gw.LogID, expiresAt]
      );

      res.json({ ok: true, message: 'OTP sent successfully', expires_in_seconds: 600 });
    } catch (e) { next(e); }
  }
);

// ── CUSTOMER: Verify OTP ──────────────────────────────────────────────────────
router.post(
  '/customer/verify-otp',
  body('phone').isString().notEmpty(),
  body('otp').isString().isLength({ min: 4, max: 8 }),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return bail(res, errors);

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const phone = normalisePhone(req.body.phone);
      if (!phone) { await conn.rollback(); return res.status(400).json({ error: 'invalid_phone' }); }

      const [rows] = await conn.execute(
        `SELECT id, log_id, attempts FROM otp_log
          WHERE phone = ? AND purpose = 'customer_login' AND is_verified = 0 AND expires_at > NOW()
          ORDER BY created_at DESC LIMIT 1`,
        [phone]
      );
      if (rows.length === 0) {
        await conn.rollback();
        return res.status(401).json({ error: 'invalid_otp', message: 'OTP is incorrect or expired.' });
      }
      const otpRow = rows[0];
      if (otpRow.attempts >= 3) {
        await conn.execute('UPDATE otp_log SET is_verified = 1 WHERE id = ?', [otpRow.id]);
        await conn.commit();
        return res.status(401).json({ error: 'otp_attempts_exhausted', message: 'Too many incorrect attempts. Please request a new OTP.' });
      }

      const verifyResult = await authkey.verifyOtp({ otp: req.body.otp, logId: otpRow.log_id });
      if (!verifyResult || verifyResult.status !== true) {
        const nextAttempts = otpRow.attempts + 1;
        await conn.execute(
          `UPDATE otp_log SET attempts = ?, is_verified = ? WHERE id = ?`,
          [nextAttempts, nextAttempts >= 3 ? 1 : 0, otpRow.id]
        );
        await conn.commit();
        return res.status(401).json({
          error: 'invalid_otp',
          message: 'OTP is incorrect or expired.',
          attempts_left: Math.max(0, 3 - nextAttempts),
        });
      }

      await conn.execute('UPDATE otp_log SET is_verified = 1 WHERE id = ?', [otpRow.id]);

      const [users] = await conn.execute(
        `SELECT id, role, phone, full_name, is_active
           FROM users WHERE phone = ? AND role = 'customer' LIMIT 1`,
        [phone]
      );
      if (users.length === 0) { await conn.rollback(); return res.status(404).json({ error: 'user_not_found' }); }

      await conn.execute('UPDATE users SET last_login = NOW() WHERE id = ?', [users[0].id]);
      await conn.commit();
      res.json({
        access_token:  signAccess(users[0]),
        refresh_token: signRefresh(users[0]),
        user:          users[0],
      });
    } catch (e) {
      await conn.rollback().catch(() => {});
      next(e);
    } finally { conn.release(); }
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
