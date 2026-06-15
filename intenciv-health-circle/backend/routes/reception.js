/**
 * Reception routes — role: reception (or admin).
 *
 * Coupon lookup + avail for the front-desk panel.
 */
const express = require('express');
const { pool } = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');
const socket = require('../services/socket');

const router = express.Router();
router.use(authenticate, requireRole('reception', 'admin'));

router.get('/lookup/:code', async (req, res, next) => {
  try {
    const code = String(req.params.code || '').trim().toUpperCase();
    const [rows] = await pool.execute(
      `SELECT cp.id, cp.coupon_code, cp.benefit_name, cp.benefit_code, cp.status, cp.used_at, cp.expires_at,
              cd.card_number, cd.id AS card_id,
              u.full_name AS member_name, u.phone AS member_phone,
              p.name AS plan_name,
              a.full_name AS used_by_admin_name
         FROM coupons cp
         JOIN cards cd ON cd.id = cp.card_id
         JOIN users u  ON u.id  = cp.customer_id
         JOIN plans p  ON p.id  = cd.plan_id
    LEFT JOIN users a  ON a.id  = cp.used_by_admin
        WHERE cp.coupon_code = ? LIMIT 1`,
      [code]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'coupon_not_found' });
    const c = rows[0];
    if (c.status === 'unused' && new Date(c.expires_at) < new Date()) {
      await pool.execute(`UPDATE coupons SET status = 'expired' WHERE id = ?`, [c.id]);
      c.status = 'expired';
    }
    res.json({ coupon: c });
  } catch (e) { next(e); }
});

router.post('/avail/:code', async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const code = String(req.params.code || '').trim().toUpperCase();
    const [rows] = await conn.execute(
      `SELECT id, customer_id, benefit_name, status, expires_at FROM coupons WHERE coupon_code = ? LIMIT 1 FOR UPDATE`,
      [code]
    );
    if (rows.length === 0) { await conn.rollback(); return res.status(404).json({ error: 'coupon_not_found' }); }
    const cp = rows[0];
    if (cp.status === 'used')    { await conn.rollback(); return res.status(409).json({ error: 'coupon_already_used' }); }
    if (cp.status === 'expired' || new Date(cp.expires_at) < new Date()) {
      await conn.execute(`UPDATE coupons SET status = 'expired' WHERE id = ?`, [cp.id]);
      await conn.commit();
      return res.status(409).json({ error: 'coupon_expired' });
    }
    const usedAt = new Date();
    await conn.execute(
      `UPDATE coupons SET status = 'used', used_at = ?, used_by_admin = ? WHERE id = ?`,
      [usedAt, req.user.id, cp.id]
    );
    await conn.commit();

    socket.emitToClient(cp.customer_id, 'coupon:used', {
      coupon_id: cp.id, coupon_code: code, used_at: usedAt, benefit_name: cp.benefit_name,
    });

    res.json({ ok: true, coupon_code: code, used_at: usedAt, benefit_name: cp.benefit_name });
  } catch (e) { await conn.rollback().catch(() => {}); next(e); }
  finally { conn.release(); }
});

module.exports = router;
