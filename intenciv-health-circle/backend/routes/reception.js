/**
 * Receptionist routes — role: receptionist.
 *
 *   GET  /reception/lookup/:code
 *   POST /reception/avail/:code
 */
const express = require('express');

const { pool } = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');
const { emitToClient } = require('../services/socket');

const router = express.Router();

router.use(authenticate, requireRole('receptionist'));

router.get('/lookup/:code', async (req, res, next) => {
  try {
    const code = String(req.params.code || '').trim().toUpperCase();
    if (!code) return res.status(400).json({ error: 'missing_code' });

    const [rows] = await pool.execute(
      `SELECT c.id, c.coupon_code, c.test_name, c.original_price, c.discounted_price,
              c.discount_percent, c.status, c.availed_at, c.expires_at,
              c.availed_by_receptionist_id,
              u.id   AS client_id,
              u.full_name AS client_name,
              u.phone AS client_phone,
              b.id   AS booklet_id,
              t.name AS tier_name,
              r.full_name AS availed_by_name
         FROM coupons c
         JOIN users u ON u.id = c.client_id
         JOIN booklets b ON b.id = c.booklet_id
         JOIN booklet_tiers t ON t.id = b.tier_id
    LEFT JOIN users r ON r.id = c.availed_by_receptionist_id
        WHERE c.coupon_code = ?
        LIMIT 1`,
      [code]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'coupon_not_found' });

    const coupon = rows[0];
    // Auto-mark expired on the fly.
    if (coupon.status === 'active' && new Date(coupon.expires_at) < new Date()) {
      await pool.execute(`UPDATE coupons SET status = 'expired' WHERE id = ?`, [coupon.id]);
      coupon.status = 'expired';
    }
    res.json({ coupon });
  } catch (err) { next(err); }
});

router.post('/avail/:code', async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const code = String(req.params.code || '').trim().toUpperCase();
    if (!code) {
      await conn.rollback();
      return res.status(400).json({ error: 'missing_code' });
    }

    const [rows] = await conn.execute(
      `SELECT id, client_id, test_name, status, expires_at
         FROM coupons WHERE coupon_code = ? LIMIT 1 FOR UPDATE`,
      [code]
    );
    if (rows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: 'coupon_not_found' });
    }
    const coupon = rows[0];

    if (coupon.status === 'availed') {
      await conn.rollback();
      return res.status(409).json({ error: 'coupon_already_availed' });
    }
    if (coupon.status === 'expired' || new Date(coupon.expires_at) < new Date()) {
      await conn.execute(`UPDATE coupons SET status = 'expired' WHERE id = ?`, [coupon.id]);
      await conn.commit();
      return res.status(409).json({ error: 'coupon_expired' });
    }

    const availedAt = new Date();
    await conn.execute(
      `UPDATE coupons
          SET status = 'availed',
              availed_at = ?,
              availed_by_receptionist_id = ?
        WHERE id = ?`,
      [availedAt, req.user.id, coupon.id]
    );

    await conn.commit();

    // Realtime push to the client.
    emitToClient(coupon.client_id, 'coupon:availed', {
      coupon_id: coupon.id,
      coupon_code: code,
      availed_at: availedAt,
      test_name: coupon.test_name,
    });

    res.json({
      ok: true,
      coupon_id: coupon.id,
      coupon_code: code,
      availed_at: availedAt,
      test_name: coupon.test_name,
    });
  } catch (err) {
    await conn.rollback().catch(() => {});
    next(err);
  } finally {
    conn.release();
  }
});

module.exports = router;
