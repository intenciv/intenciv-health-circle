/**
 * Auth routes — public.
 *
 *   POST /auth/send-otp        { phone }
 *   POST /auth/verify-otp      { phone, otp }
 *   POST /auth/refresh-token   { refresh_token }
 */
const express = require('express');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');

const { pool } = require('../config/db');
const { otpLimiter } = require('../middleware/rateLimit');
const otpUtil = require('../utils/otp');
const { signAccess, signRefresh, verify } = require('../utils/jwt');
const authkey = require('../services/authkey');

const router = express.Router();

function normalisePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (digits.length === 13 && digits.startsWith('091')) return `+${digits.slice(1)}`;
  return null;
}

function bail(res, errors) {
  return res.status(400).json({ error: 'validation_failed', details: errors.array() });
}

// ---------------------------------------------------------------------
// POST /auth/send-otp
// ---------------------------------------------------------------------
router.post(
  '/send-otp',
  otpLimiter,
  body('phone').isString().notEmpty(),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return bail(res, errors);

    try {
      const phone = normalisePhone(req.body.phone);
      if (!phone) return res.status(400).json({ error: 'invalid_phone' });

      // Determine purpose by checking if user already exists.
      const [users] = await pool.execute(
        'SELECT id FROM users WHERE phone = ? LIMIT 1',
        [phone]
      );
      const purpose = users.length > 0 ? 'login' : 'registration';

      const otp = otpUtil.generate();
      const otpHash = otpUtil.hash(otp);
      const expiresAt = otpUtil.expiryDate();

      // Invalidate any previous unverified OTPs for this phone.
      await pool.execute(
        'UPDATE otp_log SET is_verified = 1 WHERE phone = ? AND is_verified = 0',
        [phone]
      );

      await pool.execute(
        `INSERT INTO otp_log (id, phone, otp_hash, purpose, is_verified, attempts, expires_at)
         VALUES (?, ?, ?, ?, 0, 0, ?)`,
        [uuidv4(), phone, otpHash, purpose, expiresAt]
      );

      // Fire and (mostly) forget — but await so we can surface SMS gateway errors.
      const gatewayResponse = await authkey.sendOtp({ phone, otp }).catch(err => ({
        gateway_error: true,
        message: err.message,
      }));

      res.json({
        ok: true,
        purpose,
        expires_in_seconds: otpUtil.OTP_TTL_MINUTES * 60,
        gateway: gatewayResponse,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------
// POST /auth/verify-otp
// ---------------------------------------------------------------------
router.post(
  '/verify-otp',
  body('phone').isString().notEmpty(),
  body('otp').isString().isLength({ min: 4, max: 4 }),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return bail(res, errors);

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const phone = normalisePhone(req.body.phone);
      if (!phone) {
        await conn.rollback();
        return res.status(400).json({ error: 'invalid_phone' });
      }

      // Latest unverified, unexpired OTP for this phone.
      const [rows] = await conn.execute(
        `SELECT id, otp_hash, attempts, expires_at
           FROM otp_log
          WHERE phone = ? AND is_verified = 0 AND expires_at > NOW()
          ORDER BY created_at DESC
          LIMIT 1`,
        [phone]
      );
      if (rows.length === 0) {
        await conn.rollback();
        return res.status(400).json({ error: 'otp_not_found_or_expired' });
      }
      const otpRow = rows[0];

      if (otpRow.attempts >= otpUtil.OTP_MAX_ATTEMPTS) {
        await conn.execute('UPDATE otp_log SET is_verified = 1 WHERE id = ?', [otpRow.id]);
        await conn.commit();
        return res.status(400).json({ error: 'otp_attempts_exhausted' });
      }

      const submittedHash = otpUtil.hash(req.body.otp);
      if (submittedHash !== otpRow.otp_hash) {
        const newAttempts = otpRow.attempts + 1;
        if (newAttempts >= otpUtil.OTP_MAX_ATTEMPTS) {
          await conn.execute(
            'UPDATE otp_log SET attempts = ?, is_verified = 1 WHERE id = ?',
            [newAttempts, otpRow.id]
          );
        } else {
          await conn.execute(
            'UPDATE otp_log SET attempts = ? WHERE id = ?',
            [newAttempts, otpRow.id]
          );
        }
        await conn.commit();
        return res.status(400).json({
          error: 'otp_incorrect',
          attempts_left: Math.max(0, otpUtil.OTP_MAX_ATTEMPTS - newAttempts),
        });
      }

      // Success — mark verified, get/create user, mint tokens.
      await conn.execute('UPDATE otp_log SET is_verified = 1 WHERE id = ?', [otpRow.id]);

      const [userRows] = await conn.execute(
        'SELECT id, phone, full_name, email, address, city, pincode, role, is_active FROM users WHERE phone = ? LIMIT 1',
        [phone]
      );

      let user;
      let isNewUser = false;
      if (userRows.length === 0) {
        // First-time user → create as client by default (agents/receptionists
        // are pre-provisioned by an admin).
        const newId = uuidv4();
        await conn.execute(
          `INSERT INTO users (id, phone, role, is_active, created_at, last_login)
           VALUES (?, ?, 'client', 1, NOW(), NOW())`,
          [newId, phone]
        );
        user = {
          id: newId,
          phone,
          full_name: null,
          email: null,
          address: null,
          city: null,
          pincode: null,
          role: 'client',
          is_active: 1,
        };
        isNewUser = true;
      } else {
        user = userRows[0];
        if (!user.is_active) {
          await conn.rollback();
          return res.status(403).json({ error: 'account_disabled' });
        }
        await conn.execute('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);
        // is_new_user when client hasn't completed profile yet.
        isNewUser = user.role === 'client' && (!user.full_name || !user.city || !user.pincode);
      }

      await conn.commit();

      const access_token  = signAccess(user);
      const refresh_token = signRefresh(user);

      res.json({ access_token, refresh_token, user, is_new_user: isNewUser });
    } catch (err) {
      await conn.rollback().catch(() => {});
      next(err);
    } finally {
      conn.release();
    }
  }
);

// ---------------------------------------------------------------------
// POST /auth/refresh-token
// ---------------------------------------------------------------------
router.post(
  '/refresh-token',
  body('refresh_token').isString().notEmpty(),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return bail(res, errors);

    try {
      const decoded = verify(req.body.refresh_token);
      if (decoded.type !== 'refresh') {
        return res.status(401).json({ error: 'invalid_token_type' });
      }
      const [rows] = await pool.execute(
        'SELECT id, role, is_active FROM users WHERE id = ? LIMIT 1',
        [decoded.id]
      );
      if (rows.length === 0 || !rows[0].is_active) {
        return res.status(401).json({ error: 'account_unavailable' });
      }
      const access_token = signAccess(rows[0]);
      res.json({ access_token });
    } catch (_err) {
      return res.status(401).json({ error: 'invalid_or_expired_refresh' });
    }
  }
);

module.exports = router;
