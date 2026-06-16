/**
 * Reception routes — role: reception (or admin).
 *
 * Coupon lookup + avail for the front-desk panel.
 * Supports both single-use and multi-use coupons (e.g. 3x home collection/year).
 */
const express = require('express');
const { pool } = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');
const socket = require('../services/socket');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();
router.use(authenticate, requireRole('reception', 'admin'));

/* ──────────────────────────────────────────────────────────────
   GET /reception/lookup/:code
   Look up a coupon by code — returns full details including
   usage count so the front-desk can see remaining uses.
────────────────────────────────────────────────────────────── */
router.get('/lookup/:code', async (req, res, next) => {
  try {
    const code = String(req.params.code || '').trim().toUpperCase();

    const [rows] = await pool.execute(
      `SELECT
         cp.id,
         cp.coupon_code,
         cp.benefit_name,
         cp.benefit_code,
         cp.status,
         cp.max_uses,
         cp.current_uses,
         (cp.max_uses - cp.current_uses) AS remaining_uses,
         cp.used_at,
         cp.expires_at,
         cd.card_number,
         cd.id          AS card_id,
         u.full_name    AS member_name,
         u.phone        AS member_phone,
         p.name         AS plan_name,
         a.full_name    AS used_by_admin_name
       FROM coupons cp
       JOIN cards cd ON cd.id = cp.card_id
       JOIN users u  ON u.id  = cp.customer_id
       JOIN plans p  ON p.id  = cd.plan_id
  LEFT JOIN users a  ON a.id  = cp.used_by_admin
      WHERE cp.coupon_code = ?
      LIMIT 1`,
      [code]
    );

    if (rows.length === 0)
      return res.status(404).json({ error: 'coupon_not_found' });

    const c = rows[0];

    // Auto-expire if past expiry date and still unused
    if (c.status === 'unused' && new Date(c.expires_at) < new Date()) {
      await pool.execute(
        `UPDATE coupons SET status = 'expired' WHERE id = ?`,
        [c.id]
      );
      c.status = 'expired';
    }

    // Fetch redemption history for this coupon
    const [history] = await pool.execute(
      `SELECT
         cr.id,
         cr.redeemed_at,
         cr.service_note,
         cr.status,
         u.full_name AS redeemed_by_name
       FROM coupon_redemptions cr
  LEFT JOIN users u ON u.id = cr.redeemed_by
      WHERE cr.coupon_id = ?
   ORDER BY cr.redeemed_at DESC`,
      [c.id]
    );

    res.json({
      coupon: {
        ...c,
        redemption_history: history,
      },
    });
  } catch (e) {
    next(e);
  }
});

/* ──────────────────────────────────────────────────────────────
   POST /reception/avail/:code
   Avail (redeem) a coupon. Handles both:
     • Single-use  (max_uses = 1) — marks status = 'used'
     • Multi-use   (max_uses > 1) — increments current_uses,
                                    only marks 'used' on final redemption
   Body (optional): { service_note: "Home collection - Sector 12" }
────────────────────────────────────────────────────────────── */
router.post('/avail/:code', async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const code        = String(req.params.code || '').trim().toUpperCase();
    const serviceNote = String(req.body?.service_note || '').trim() || null;

    // Lock the row so concurrent requests don't double-redeem
    const [rows] = await conn.execute(
      `SELECT
         id, customer_id, card_id, coupon_code,
         benefit_name, benefit_code,
         status, max_uses, current_uses, expires_at
       FROM coupons
      WHERE coupon_code = ?
      LIMIT 1
      FOR UPDATE`,
      [code]
    );

    if (rows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'coupon_not_found' });
    }

    const cp = rows[0];

    // Already fully used
    if (cp.status === 'used') {
      await conn.rollback();
      return res.status(409).json({ error: 'coupon_already_used' });
    }

    // Expired
    if (cp.status === 'expired' || new Date(cp.expires_at) < new Date()) {
      await conn.execute(
        `UPDATE coupons SET status = 'expired' WHERE id = ?`,
        [cp.id]
      );
      await conn.commit();
      return res.status(409).json({ error: 'coupon_expired' });
    }

    const newUseCount  = cp.current_uses + 1;
    const isFullyUsed  = newUseCount >= cp.max_uses;
    const redeemedAt   = new Date();
    const redemptionId = uuidv4();

    // Update coupon — mark 'used' only when all uses are exhausted
    await conn.execute(
      `UPDATE coupons
          SET current_uses  = ?,
              status        = ?,
              used_at       = ?,
              used_by_admin = ?
        WHERE id = ?`,
      [
        newUseCount,
        isFullyUsed ? 'used' : 'unused',
        isFullyUsed ? redeemedAt : cp.used_at, // keep original used_at if not final
        req.user.id,
        cp.id,
      ]
    );

    // Log every redemption event in coupon_redemptions
    await conn.execute(
      `INSERT INTO coupon_redemptions
         (id, coupon_id, coupon_code, card_id, customer_id, redeemed_by, redeemed_at, service_note, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'success')`,
      [
        redemptionId,
        cp.id,
        cp.coupon_code,
        cp.card_id,
        cp.customer_id,
        req.user.id,
        redeemedAt,
        serviceNote,
      ]
    );

    await conn.commit();

    // Notify customer app in real-time via socket
    socket.emitToClient(cp.customer_id, 'coupon:used', {
      coupon_id      : cp.id,
      coupon_code    : cp.coupon_code,
      benefit_name   : cp.benefit_name,
      used_at        : redeemedAt,
      current_uses   : newUseCount,
      max_uses       : cp.max_uses,
      remaining_uses : cp.max_uses - newUseCount,
      fully_used     : isFullyUsed,
    });

    res.json({
      ok             : true,
      coupon_code    : cp.coupon_code,
      benefit_name   : cp.benefit_name,
      redeemed_at    : redeemedAt,
      current_uses   : newUseCount,
      max_uses       : cp.max_uses,
      remaining_uses : cp.max_uses - newUseCount,
      fully_used     : isFullyUsed,
      redemption_id  : redemptionId,
    });
  } catch (e) {
    await conn.rollback().catch(() => {});
    next(e);
  } finally {
    conn.release();
  }
});

/* ──────────────────────────────────────────────────────────────
   GET /reception/redemptions/:couponId
   Full redemption history for a coupon (for admin audit view).
────────────────────────────────────────────────────────────── */
router.get('/redemptions/:couponId', async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT
         cr.id,
         cr.coupon_code,
         cr.redeemed_at,
         cr.service_note,
         cr.status,
         u.full_name AS redeemed_by_name
       FROM coupon_redemptions cr
  LEFT JOIN users u ON u.id = cr.redeemed_by
      WHERE cr.coupon_id = ?
   ORDER BY cr.redeemed_at DESC`,
      [req.params.couponId]
    );

    res.json({ redemptions: rows });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
