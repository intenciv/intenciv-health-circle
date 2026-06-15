/**
 * Customer routes — role: customer.
 *
 *   GET /customer/me                — full membership summary (member + card + plan + counts)
 *   GET /customer/coupons           — all coupons grouped by benefit
 *   GET /customer/coupons/:code     — single coupon detail
 *   GET /customer/offers            — active offers banner list
 */
const express = require('express');

const { pool } = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, requireRole('customer'));

// ── GET /customer/me ──────────────────────────────────────────────────────────
router.get('/me', async (req, res, next) => {
  try {
    const [cards] = await pool.execute(
      `SELECT c.id, c.card_number, c.status, c.activated_at, c.expires_at,
              p.id AS plan_id, p.name AS plan_name, p.description AS plan_description,
              u.full_name AS member_name, u.phone AS member_phone
         FROM cards c
         JOIN plans p ON p.id = c.plan_id
         JOIN users u ON u.id = c.customer_id
        WHERE c.customer_id = ? AND c.status = 'active'
        ORDER BY c.activated_at DESC LIMIT 1`,
      [req.user.id]
    );
    if (cards.length === 0) return res.status(404).json({ error: 'no_active_membership' });
    const card = cards[0];

    const [[counts]] = await pool.execute(
      `SELECT
         SUM(status = 'unused')  AS unused_count,
         SUM(status = 'used')    AS used_count,
         SUM(status = 'expired') AS expired_count,
         COUNT(*)                AS total_count
       FROM coupons WHERE card_id = ?`,
      [card.id]
    );

    const daysRemaining = Math.max(0, Math.ceil((new Date(card.expires_at) - Date.now()) / 86400000));

    res.json({
      member: {
        name:  card.member_name,
        phone: card.member_phone,
      },
      card: {
        id:           card.id,
        number:       card.card_number,
        status:       card.status,
        activated_at: card.activated_at,
        expires_at:   card.expires_at,
        days_remaining: daysRemaining,
      },
      plan: {
        id:          card.plan_id,
        name:        card.plan_name,
        description: card.plan_description,
      },
      coupons: {
        total:   Number(counts.total_count   || 0),
        unused:  Number(counts.unused_count  || 0),
        used:    Number(counts.used_count    || 0),
        expired: Number(counts.expired_count || 0),
      },
    });
  } catch (e) { next(e); }
});

// ── GET /customer/coupons ─────────────────────────────────────────────────────
router.get('/coupons', async (req, res, next) => {
  try {
    const [cardRows] = await pool.execute(
      `SELECT id, plan_id, expires_at FROM cards
        WHERE customer_id = ? AND status = 'active'
        ORDER BY activated_at DESC LIMIT 1`,
      [req.user.id]
    );
    if (cardRows.length === 0) return res.json({ benefits: [] });
    const card = cardRows[0];

    // Auto-expire overdue coupons
    await pool.execute(
      `UPDATE coupons SET status = 'expired'
        WHERE card_id = ? AND status = 'unused' AND expires_at < NOW()`,
      [card.id]
    );

    const [benefits] = await pool.execute(
      `SELECT id, benefit_code, name, description, num_coupons,
              discount_type, discount_value, conditions, sort_order
         FROM plan_benefits WHERE plan_id = ? ORDER BY sort_order ASC`,
      [card.plan_id]
    );
    const [coupons] = await pool.execute(
      `SELECT id, coupon_code, benefit_id, status, used_at, expires_at
         FROM coupons WHERE card_id = ? ORDER BY coupon_code ASC`,
      [card.id]
    );

    const byBenefit = {};
    for (const c of coupons) (byBenefit[c.benefit_id] ||= []).push(c);

    res.json({
      benefits: benefits.map(b => {
        const list = byBenefit[b.id] || [];
        return {
          ...b,
          coupons: list,
          total:   list.length,
          unused:  list.filter(c => c.status === 'unused').length,
          used:    list.filter(c => c.status === 'used').length,
          expired: list.filter(c => c.status === 'expired').length,
        };
      }),
    });
  } catch (e) { next(e); }
});

// ── GET /customer/coupons/:code ───────────────────────────────────────────────
router.get('/coupons/:code', async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT c.id, c.coupon_code, c.status, c.used_at, c.expires_at,
              b.benefit_code, b.name AS benefit_name, b.description,
              b.discount_type, b.discount_value, b.conditions,
              ca.card_number, ca.expires_at AS card_expires_at
         FROM coupons c
         JOIN plan_benefits b ON b.id  = c.benefit_id
         JOIN cards ca        ON ca.id = c.card_id
        WHERE c.coupon_code = ? AND ca.customer_id = ?
        LIMIT 1`,
      [req.params.code, req.user.id]
    );
    if (rows.length === 0)
      return res.status(404).json({ error: 'coupon_not_found' });
    res.json(rows[0]);
  } catch (e) { next(e); }
});

// ── GET /customer/offers ──────────────────────────────────────────────────────
router.get('/offers', async (_req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id, title, subtitle, image_url, link_url
         FROM offers
        WHERE is_active = 1
        ORDER BY sort_order ASC, created_at DESC
        LIMIT 20`
    );
    res.json({ offers: rows });
  } catch (e) { next(e); }
});

module.exports = router;
