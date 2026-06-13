/**
 * Sales-agent routes — role: sales_agent.
 *
 *   POST /agent/activate-booklet
 *   GET  /agent/my-sales
 *   GET  /agent/verify-client/:phone
 */
const express = require('express');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');

const { pool } = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');
const { couponCode } = require('../utils/codes');
const authkey = require('../services/authkey');

const router = express.Router();

router.use(authenticate, requireRole('sales_agent'));

function normalisePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  return null;
}

router.get('/verify-client/:phone', async (req, res, next) => {
  try {
    const phone = normalisePhone(req.params.phone);
    if (!phone) return res.status(400).json({ error: 'invalid_phone' });
    const [rows] = await pool.execute(
      'SELECT id, phone, full_name, email, role FROM users WHERE phone = ? LIMIT 1',
      [phone]
    );
    if (rows.length === 0) return res.json({ exists: false });
    res.json({ exists: true, user: rows[0] });
  } catch (err) { next(err); }
});

router.get('/my-sales', async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT b.id, b.client_id, u.full_name AS client_name, u.phone AS client_phone,
              t.name AS tier_name, b.amount_paid, b.activation_code_used,
              b.status, b.activated_at, b.expires_at,
              (SELECT COUNT(*) FROM coupons c WHERE c.booklet_id = b.id) AS total_coupons,
              (SELECT COUNT(*) FROM coupons c WHERE c.booklet_id = b.id AND c.status = 'availed') AS coupons_availed
         FROM booklets b
         JOIN users u ON u.id = b.client_id
         JOIN booklet_tiers t ON t.id = b.tier_id
        WHERE b.sold_by_agent_id = ?
        ORDER BY b.activated_at DESC`,
      [req.user.id]
    );

    // Aggregates.
    const today = rows.filter(r => {
      const d = new Date(r.activated_at);
      const now = new Date();
      return d.toDateString() === now.toDateString();
    }).length;

    const monthTotal = rows
      .filter(r => {
        const d = new Date(r.activated_at);
        const now = new Date();
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((sum, r) => sum + Number(r.amount_paid || 0), 0);

    res.json({ sales: rows, summary: { today_count: today, month_total: monthTotal } });
  } catch (err) { next(err); }
});

router.post(
  '/activate-booklet',
  body('client_phone').isString().notEmpty(),
  body('tier_id').isString().notEmpty(),
  body('activation_code').isString().notEmpty(),
  body('amount_paid').isFloat({ min: 0 }),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: 'validation_failed', details: errors.array() });

    const phone = normalisePhone(req.body.client_phone);
    if (!phone) return res.status(400).json({ error: 'invalid_phone' });

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // 1. Atomically reserve the activation code.
      //    SELECT ... FOR UPDATE prevents two agents from concurrent
      //    redemption of the same code.
      const [codeRows] = await conn.execute(
        `SELECT id, code, tier_id, assigned_agent_id, is_used
           FROM activation_codes
          WHERE code = ?
          LIMIT 1 FOR UPDATE`,
        [req.body.activation_code]
      );
      if (codeRows.length === 0) {
        await conn.rollback();
        return res.status(400).json({ error: 'activation_code_not_found' });
      }
      const code = codeRows[0];
      if (code.is_used) {
        await conn.rollback();
        return res.status(409).json({ error: 'activation_code_already_used' });
      }
      if (code.tier_id !== req.body.tier_id) {
        await conn.rollback();
        return res.status(400).json({ error: 'activation_code_tier_mismatch' });
      }
      if (code.assigned_agent_id && code.assigned_agent_id !== req.user.id) {
        await conn.rollback();
        return res.status(403).json({ error: 'activation_code_not_assigned_to_you' });
      }

      // 2. Load tier + tests.
      const [tierRows] = await conn.execute(
        'SELECT id, name, validity_days, is_active FROM booklet_tiers WHERE id = ? LIMIT 1',
        [code.tier_id]
      );
      if (tierRows.length === 0 || !tierRows[0].is_active) {
        await conn.rollback();
        return res.status(400).json({ error: 'tier_unavailable' });
      }
      const tier = tierRows[0];

      const [tests] = await conn.execute(
        `SELECT test_name, original_price, discounted_price, sort_order
           FROM tier_tests WHERE tier_id = ? ORDER BY sort_order ASC`,
        [tier.id]
      );
      if (tests.length === 0) {
        await conn.rollback();
        return res.status(400).json({ error: 'tier_has_no_tests' });
      }

      // 3. Ensure client user exists.
      const [existingClient] = await conn.execute(
        'SELECT id, role, is_active FROM users WHERE phone = ? LIMIT 1',
        [phone]
      );
      let clientId;
      if (existingClient.length === 0) {
        clientId = uuidv4();
        await conn.execute(
          `INSERT INTO users (id, phone, role, is_active, created_at) VALUES (?, ?, 'client', 1, NOW())`,
          [clientId, phone]
        );
      } else {
        if (!existingClient[0].is_active) {
          await conn.rollback();
          return res.status(403).json({ error: 'client_disabled' });
        }
        clientId = existingClient[0].id;
      }

      // 4. Create booklet.
      const bookletId = uuidv4();
      const activatedAt = new Date();
      const expiresAt = new Date(activatedAt.getTime() + tier.validity_days * 24 * 3600 * 1000);

      await conn.execute(
        `INSERT INTO booklets
            (id, client_id, tier_id, sold_by_agent_id, activation_code_used,
             status, activated_at, expires_at, amount_paid, created_at)
         VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, NOW())`,
        [
          bookletId, clientId, tier.id, req.user.id, code.code,
          activatedAt, expiresAt, req.body.amount_paid,
        ]
      );

      // 5. Mark code used.
      await conn.execute(
        `UPDATE activation_codes
            SET is_used = 1, used_at = NOW(), used_by_agent_id = ?
          WHERE id = ?`,
        [req.user.id, code.id]
      );

      // 6. Generate coupons, retrying on rare unique-code collision.
      const couponsCreated = [];
      for (const t of tests) {
        const discountPercent = t.original_price > 0
          ? Number(((t.original_price - t.discounted_price) / t.original_price * 100).toFixed(2))
          : 0;

        let inserted = false;
        let attempts = 0;
        let cId, cCode;
        while (!inserted && attempts < 5) {
          attempts++;
          cId = uuidv4();
          cCode = couponCode(t.test_name);
          try {
            await conn.execute(
              `INSERT INTO coupons
                  (id, booklet_id, client_id, test_name, original_price, discounted_price,
                   discount_percent, coupon_code, status, expires_at, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, NOW())`,
              [
                cId, bookletId, clientId, t.test_name,
                t.original_price, t.discounted_price, discountPercent,
                cCode, expiresAt,
              ]
            );
            inserted = true;
          } catch (err) {
            if (err.code !== 'ER_DUP_ENTRY') throw err;
          }
        }
        if (!inserted) throw new Error('coupon_code_collision_exceeded');

        couponsCreated.push({
          id: cId,
          test_name: t.test_name,
          original_price: t.original_price,
          discounted_price: t.discounted_price,
          discount_percent: discountPercent,
          coupon_code: cCode,
          status: 'active',
          expires_at: expiresAt,
        });
      }

      await conn.commit();

      // 7. Welcome SMS (best-effort).
      authkey.sendWelcome({
        phone,
        tierName: tier.name,
        couponCount: couponsCreated.length,
        expiresAt,
      }).catch(() => {});

      res.status(201).json({
        booklet: {
          id: bookletId,
          client_id: clientId,
          tier_id: tier.id,
          tier_name: tier.name,
          activation_code_used: code.code,
          activated_at: activatedAt,
          expires_at: expiresAt,
          amount_paid: Number(req.body.amount_paid),
        },
        coupons: couponsCreated,
      });
    } catch (err) {
      await conn.rollback().catch(() => {});
      next(err);
    } finally {
      conn.release();
    }
  }
);

module.exports = router;
