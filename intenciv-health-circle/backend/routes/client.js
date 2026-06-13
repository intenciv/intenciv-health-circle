/**
 * Client routes — role: client.
 *
 *   GET  /client/profile
 *   PUT  /client/profile
 *   GET  /client/coupons
 *   GET  /client/booklets
 */
const express = require('express');
const { body, validationResult } = require('express-validator');

const { pool } = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate, requireRole('client'));

router.get('/profile', async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id, phone, full_name, email, address, city, pincode, role, is_active, created_at, last_login
         FROM users WHERE id = ? LIMIT 1`,
      [req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'user_not_found' });
    res.json({ user: rows[0] });
  } catch (err) { next(err); }
});

router.put(
  '/profile',
  body('full_name').optional({ nullable: true }).isString().isLength({ min: 2, max: 100 }),
  body('email').optional({ nullable: true }).isEmail(),
  body('address').optional({ nullable: true }).isString().isLength({ max: 500 }),
  body('city').optional({ nullable: true }).isString().isLength({ max: 60 }),
  body('pincode').optional({ nullable: true }).isString().isLength({ min: 4, max: 10 }),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'validation_failed', details: errors.array() });

    try {
      const fields = ['full_name', 'email', 'address', 'city', 'pincode'];
      const sets = [];
      const params = [];
      for (const f of fields) {
        if (Object.prototype.hasOwnProperty.call(req.body, f)) {
          sets.push(`\`${f}\` = ?`);
          params.push(req.body[f] ?? null);
        }
      }
      if (sets.length === 0) return res.status(400).json({ error: 'no_fields_to_update' });
      params.push(req.user.id);
      await pool.execute(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, params);

      const [rows] = await pool.execute(
        `SELECT id, phone, full_name, email, address, city, pincode, role, is_active, created_at, last_login
           FROM users WHERE id = ? LIMIT 1`,
        [req.user.id]
      );
      res.json({ user: rows[0] });
    } catch (err) { next(err); }
  }
);

router.get('/coupons', async (req, res, next) => {
  try {
    // Auto-expire coupons whose expiry has passed.
    await pool.execute(
      `UPDATE coupons SET status = 'expired'
        WHERE client_id = ? AND status = 'active' AND expires_at < NOW()`,
      [req.user.id]
    );

    const [rows] = await pool.execute(
      `SELECT id, booklet_id, test_name, original_price, discounted_price, discount_percent,
              coupon_code, status, availed_at, expires_at, created_at
         FROM coupons
        WHERE client_id = ?
        ORDER BY (status = 'active') DESC, expires_at ASC`,
      [req.user.id]
    );
    res.json({ coupons: rows });
  } catch (err) { next(err); }
});

router.get('/booklets', async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT b.id, b.tier_id, b.activation_code_used, b.status, b.activated_at, b.expires_at,
              b.amount_paid, t.name AS tier_name, t.description AS tier_description
         FROM booklets b
         JOIN booklet_tiers t ON t.id = b.tier_id
        WHERE b.client_id = ?
        ORDER BY b.activated_at DESC`,
      [req.user.id]
    );
    res.json({ booklets: rows });
  } catch (err) { next(err); }
});

module.exports = router;
