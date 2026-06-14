/**
 * Admin routes — role: admin.
 *
 * Dashboard + Salesperson + Plan/Benefit + Card-batch + Reception + Offers + Reports.
 *
 * Reception lookup / avail require an additional `x-admin-password`
 * header on every call (see middleware/auth.js → requireAdminPassword).
 */
const express = require('express');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');

const { pool } = require('../config/db');
const { authenticate, requireRole, requireAdminPassword } = require('../middleware/auth');
const { hashPassword, hashPin, isValidPin, verifyPassword } = require('../utils/passwords');
const { allocateCardSequences } = require('../utils/cards');
const socket = require('../services/socket');

const router = express.Router();
router.use(authenticate, requireRole('admin'));

function bail(res, errors) { return res.status(400).json({ error: 'validation_failed', details: errors.array() }); }
function normalisePhone(raw) {
  const d = String(raw || '').replace(/\D/g, '');
  if (d.length === 10) return `+91${d}`;
  if (d.length === 12 && d.startsWith('91')) return `+${d}`;
  return null;
}
function csv(rows) {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  return [headers.join(','), ...rows.map(r => headers.map(h => {
    const v = r[h]; if (v === null || v === undefined) return '';
    const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(','))].join('\n');
}
function sendCSV(res, name, rows) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${name}.csv"`);
  res.send(csv(rows));
}

// ============ DASHBOARD ============
router.get('/dashboard', async (_req, res, next) => {
  try {
    const q = async (sql, p=[]) => (await pool.execute(sql, p))[0][0].c;
    const r = async (sql, p=[]) => (await pool.execute(sql, p))[0][0].s;

    const today      = await q(`SELECT COUNT(*) AS c FROM cards WHERE status = 'active' AND DATE(activated_at) = CURDATE()`);
    const month      = await q(`SELECT COUNT(*) AS c FROM cards WHERE status = 'active' AND YEAR(activated_at)=YEAR(CURDATE()) AND MONTH(activated_at)=MONTH(CURDATE())`);
    const allTime    = await q(`SELECT COUNT(*) AS c FROM cards WHERE status IN ('active','expired')`);
    const activeNow  = await q(`SELECT COUNT(*) AS c FROM cards WHERE status = 'active' AND expires_at > NOW()`);
    const expired    = await q(`SELECT COUNT(*) AS c FROM cards WHERE status = 'expired' OR (status = 'active' AND expires_at <= NOW())`);

    const revMonth   = (await pool.execute(
      `SELECT IFNULL(SUM(amount_paid),0) AS s FROM cards
        WHERE status = 'active' AND YEAR(activated_at)=YEAR(CURDATE()) AND MONTH(activated_at)=MONTH(CURDATE())`
    ))[0][0].s;
    const revAll     = (await pool.execute(
      `SELECT IFNULL(SUM(amount_paid),0) AS s FROM cards WHERE status IN ('active','expired')`
    ))[0][0].s;

    const [topSp] = await pool.execute(
      `SELECT u.id, u.full_name, u.phone, COUNT(c.id) AS cards_sold,
              IFNULL(SUM(c.amount_paid),0) AS revenue
         FROM users u
    LEFT JOIN cards c ON c.activated_by_salesperson = u.id AND c.status IN ('active','expired')
        WHERE u.role = 'salesperson'
        GROUP BY u.id ORDER BY cards_sold DESC LIMIT 10`
    );

    res.json({
      cards_today:       today,
      cards_this_month:  month,
      cards_all_time:    allTime,
      active_memberships:    activeNow,
      expired_memberships:   expired,
      revenue_this_month: Number(revMonth),
      revenue_all_time:   Number(revAll),
      top_salespersons:   topSp,
    });
  } catch (e) { next(e); }
});

// ============ SALESPERSONS ============
router.get('/salespersons', async (_req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT u.id, u.full_name, u.phone, u.is_active, u.created_at, u.last_login,
              (SELECT COUNT(*) FROM cards c WHERE c.activated_by_salesperson = u.id AND DATE(c.activated_at)=CURDATE())              AS today_count,
              (SELECT COUNT(*) FROM cards c WHERE c.activated_by_salesperson = u.id AND c.activated_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS week_count,
              (SELECT COUNT(*) FROM cards c WHERE c.activated_by_salesperson = u.id AND YEAR(c.activated_at)=YEAR(CURDATE()) AND MONTH(c.activated_at)=MONTH(CURDATE())) AS month_count,
              (SELECT COUNT(*) FROM cards c WHERE c.activated_by_salesperson = u.id AND c.status IN ('active','expired'))            AS total_count
         FROM users u WHERE u.role = 'salesperson' ORDER BY u.full_name ASC`
    );
    res.json({ salespersons: rows });
  } catch (e) { next(e); }
});

router.post(
  '/salespersons',
  body('full_name').isString().isLength({ min: 2, max: 100 }),
  body('phone').isString().notEmpty(),
  body('pin').isString(),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return bail(res, errors);
    try {
      const phone = normalisePhone(req.body.phone);
      if (!phone) return res.status(400).json({ error: 'invalid_phone' });
      if (!isValidPin(req.body.pin)) return res.status(400).json({ error: 'pin_must_be_4_digits' });

      const [exists] = await pool.execute('SELECT id FROM users WHERE phone = ? LIMIT 1', [phone]);
      if (exists.length > 0) return res.status(409).json({ error: 'phone_already_in_use' });

      const id = uuidv4();
      const pinHash = await hashPin(req.body.pin);
      await pool.execute(
        `INSERT INTO users (id, role, phone, full_name, pin_hash, is_active, created_at)
         VALUES (?, 'salesperson', ?, ?, ?, 1, NOW())`,
        [id, phone, req.body.full_name, pinHash]
      );
      res.status(201).json({ id, phone, full_name: req.body.full_name });
    } catch (e) { next(e); }
  }
);

router.put(
  '/salespersons/:id',
  body('full_name').optional().isString(),
  body('phone').optional().isString(),
  body('pin').optional().isString(),
  body('is_active').optional().isBoolean(),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return bail(res, errors);
    try {
      const sets = [], params = [];
      if (req.body.full_name) { sets.push('full_name = ?'); params.push(req.body.full_name); }
      if (req.body.phone)     {
        const p = normalisePhone(req.body.phone);
        if (!p) return res.status(400).json({ error: 'invalid_phone' });
        sets.push('phone = ?'); params.push(p);
      }
      if (req.body.pin) {
        if (!isValidPin(req.body.pin)) return res.status(400).json({ error: 'pin_must_be_4_digits' });
        sets.push('pin_hash = ?'); params.push(await hashPin(req.body.pin));
      }
      if (typeof req.body.is_active === 'boolean') {
        sets.push('is_active = ?'); params.push(req.body.is_active ? 1 : 0);
      }
      if (sets.length === 0) return res.status(400).json({ error: 'nothing_to_update' });
      params.push(req.params.id);
      await pool.execute(`UPDATE users SET ${sets.join(', ')} WHERE id = ? AND role = 'salesperson'`, params);
      res.json({ ok: true });
    } catch (e) { next(e); }
  }
);

router.delete('/salespersons/:id', async (req, res, next) => {
  try {
    // Soft delete = deactivate (we keep card history intact).
    await pool.execute(`UPDATE users SET is_active = 0 WHERE id = ? AND role = 'salesperson'`, [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ============ PLANS + BENEFITS ============
router.get('/plans', async (_req, res, next) => {
  try {
    const [plans] = await pool.execute(`SELECT * FROM plans ORDER BY is_corporate ASC, price ASC`);
    const [benefits] = await pool.execute(`SELECT * FROM plan_benefits ORDER BY plan_id, sort_order ASC`);
    const map = {};
    benefits.forEach(b => (map[b.plan_id] ||= []).push(b));
    res.json({ plans: plans.map(p => ({ ...p, benefits: map[p.id] || [] })) });
  } catch (e) { next(e); }
});

router.post(
  '/plans',
  body('name').isString().notEmpty(),
  body('price').isFloat({ min: 0 }),
  body('validity_days').optional().isInt({ min: 1 }),
  body('is_corporate').optional().isBoolean(),
  body('benefits').isArray({ min: 1 }),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return bail(res, errors);
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const id = uuidv4();
      await conn.execute(
        `INSERT INTO plans (id, name, description, price, validity_days, is_corporate, corporate_client_name, min_card_quantity, is_active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, NOW())`,
        [
          id, req.body.name, req.body.description || null, req.body.price,
          req.body.validity_days || 365, req.body.is_corporate ? 1 : 0,
          req.body.corporate_client_name || null, req.body.min_card_quantity || 1,
        ]
      );
      for (let i = 0; i < req.body.benefits.length; i++) {
        const b = req.body.benefits[i];
        await conn.execute(
          `INSERT INTO plan_benefits (id, plan_id, benefit_code, name, description, num_coupons, discount_type, discount_value, conditions, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            uuidv4(), id,
            String(b.benefit_code || 'XX').toUpperCase().slice(0, 4),
            b.name, b.description || null,
            Number(b.num_coupons) || 1,
            b.discount_type || 'percent',
            b.discount_value ?? null,
            b.conditions || null,
            i + 1,
          ]
        );
      }
      await conn.commit();
      res.status(201).json({ id });
    } catch (e) { await conn.rollback().catch(() => {}); next(e); }
    finally { conn.release(); }
  }
);

router.put(
  '/plans/:id',
  body('benefits').optional().isArray(),
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const fields = ['name','description','price','validity_days','is_corporate','corporate_client_name','min_card_quantity','is_active'];
      const sets = [], params = [];
      for (const f of fields) {
        if (Object.prototype.hasOwnProperty.call(req.body, f)) {
          sets.push(`${f} = ?`);
          params.push(typeof req.body[f] === 'boolean' ? (req.body[f] ? 1 : 0) : req.body[f]);
        }
      }
      if (sets.length > 0) {
        params.push(req.params.id);
        await conn.execute(`UPDATE plans SET ${sets.join(', ')} WHERE id = ?`, params);
      }
      if (Array.isArray(req.body.benefits)) {
        await conn.execute(`DELETE FROM plan_benefits WHERE plan_id = ?`, [req.params.id]);
        for (let i = 0; i < req.body.benefits.length; i++) {
          const b = req.body.benefits[i];
          await conn.execute(
            `INSERT INTO plan_benefits (id, plan_id, benefit_code, name, description, num_coupons, discount_type, discount_value, conditions, sort_order)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              uuidv4(), req.params.id,
              String(b.benefit_code || 'XX').toUpperCase().slice(0, 4),
              b.name, b.description || null,
              Number(b.num_coupons) || 1,
              b.discount_type || 'percent',
              b.discount_value ?? null,
              b.conditions || null,
              i + 1,
            ]
          );
        }
      }
      await conn.commit();
      res.json({ ok: true });
    } catch (e) { await conn.rollback().catch(() => {}); next(e); }
    finally { conn.release(); }
  }
);

// ============ CARD BATCHES ============
router.get('/cards', async (req, res, next) => {
  try {
    const filters = [], params = [];
    if (req.query.plan_id)        { filters.push('c.plan_id = ?');                 params.push(req.query.plan_id); }
    if (req.query.salesperson_id) { filters.push('c.assigned_to_salesperson = ?'); params.push(req.query.salesperson_id); }
    if (req.query.status)         { filters.push('c.status = ?');                  params.push(req.query.status); }
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const [rows] = await pool.execute(
      `SELECT c.id, c.card_number, c.status, c.activated_at, c.expires_at, c.amount_paid,
              p.name AS plan_name,
              sp.full_name AS salesperson_name, sp.phone AS salesperson_phone,
              cu.full_name AS customer_name, cu.phone AS customer_phone
         FROM cards c
         JOIN plans p ON p.id = c.plan_id
    LEFT JOIN users sp ON sp.id = c.assigned_to_salesperson
    LEFT JOIN users cu ON cu.id = c.customer_id
         ${where}
        ORDER BY c.created_at DESC LIMIT 5000`,
      params
    );
    if (req.query.format === 'csv') return sendCSV(res, 'cards', rows);
    res.json({ cards: rows });
  } catch (e) { next(e); }
});

router.post(
  '/cards/batch',
  body('plan_id').isString().notEmpty(),
  body('count').isInt({ min: 1, max: 1000 }),
  body('assign_to_salesperson_id').optional({ nullable: true }).isString(),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return bail(res, errors);
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [plan] = await conn.execute(`SELECT id FROM plans WHERE id = ? LIMIT 1`, [req.body.plan_id]);
      if (plan.length === 0) { await conn.rollback(); return res.status(400).json({ error: 'plan_not_found' }); }

      if (req.body.assign_to_salesperson_id) {
        const [sp] = await conn.execute(
          `SELECT id FROM users WHERE id = ? AND role = 'salesperson' AND is_active = 1 LIMIT 1`,
          [req.body.assign_to_salesperson_id]
        );
        if (sp.length === 0) { await conn.rollback(); return res.status(400).json({ error: 'salesperson_not_found' }); }
      }

      const seqs = await allocateCardSequences(conn, req.body.count);
      const created = [];
      for (const s of seqs) {
        const id = uuidv4();
        await conn.execute(
          `INSERT INTO cards (id, card_number, card_seq, plan_id, status, assigned_to_salesperson, created_by_admin, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            id, s.number, s.seq, req.body.plan_id,
            req.body.assign_to_salesperson_id ? 'assigned' : 'unused',
            req.body.assign_to_salesperson_id || null,
            req.user.id,
          ]
        );
        created.push({ id, card_number: s.number });
      }
      await conn.commit();
      res.status(201).json({ created });
    } catch (e) { await conn.rollback().catch(() => {}); next(e); }
    finally { conn.release(); }
  }
);

router.put('/cards/:id/assign', body('salesperson_id').isString().notEmpty(), async (req, res, next) => {
  try {
    const [sp] = await pool.execute(
      `SELECT id FROM users WHERE id = ? AND role = 'salesperson' AND is_active = 1 LIMIT 1`,
      [req.body.salesperson_id]
    );
    if (sp.length === 0) return res.status(400).json({ error: 'salesperson_not_found' });
    const [r] = await pool.execute(
      `UPDATE cards SET assigned_to_salesperson = ?, status = IF(status = 'unused','assigned',status)
        WHERE id = ? AND status IN ('unused','assigned')`,
      [req.body.salesperson_id, req.params.id]
    );
    if (r.affectedRows === 0) return res.status(409).json({ error: 'card_not_assignable' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ============ RECEPTION (admin password gated) ============
router.get('/reception/lookup/:code', requireAdminPassword, async (req, res, next) => {
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

router.post('/reception/avail/:code', requireAdminPassword, async (req, res, next) => {
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

// ============ OFFERS ============
router.get('/offers', async (_req, res, next) => {
  try {
    const [rows] = await pool.execute(`SELECT * FROM offers ORDER BY sort_order ASC, created_at DESC`);
    res.json({ offers: rows });
  } catch (e) { next(e); }
});

router.post(
  '/offers',
  body('title').isString().notEmpty(),
  body('image_url').optional().isString(),
  body('link_url').optional({ nullable: true }).isString(),
  body('subtitle').optional({ nullable: true }).isString(),
  async (req, res, next) => {
    try {
      const id = uuidv4();
      await pool.execute(
        `INSERT INTO offers (id, title, subtitle, image_url, link_url, is_active, sort_order, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?, NOW())`,
        [id, req.body.title, req.body.subtitle || null, req.body.image_url || null,
         req.body.link_url || null, Number(req.body.sort_order || 0), req.user.id]
      );
      res.status(201).json({ id });
    } catch (e) { next(e); }
  }
);

router.put('/offers/:id', async (req, res, next) => {
  try {
    const fields = ['title','subtitle','image_url','link_url','is_active','sort_order'];
    const sets = [], params = [];
    for (const f of fields) {
      if (Object.prototype.hasOwnProperty.call(req.body, f)) {
        sets.push(`${f} = ?`); params.push(typeof req.body[f] === 'boolean' ? (req.body[f] ? 1 : 0) : req.body[f]);
      }
    }
    if (sets.length === 0) return res.status(400).json({ error: 'nothing_to_update' });
    params.push(req.params.id);
    await pool.execute(`UPDATE offers SET ${sets.join(', ')} WHERE id = ?`, params);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/offers/:id', async (req, res, next) => {
  try { await pool.execute(`DELETE FROM offers WHERE id = ?`, [req.params.id]); res.json({ ok: true }); }
  catch (e) { next(e); }
});

// ============ REPORTS ============
router.get('/reports/sales', async (req, res, next) => {
  try {
    const filters = [], params = [];
    if (req.query.from)            { filters.push('c.activated_at >= ?');           params.push(req.query.from); }
    if (req.query.to)              { filters.push('c.activated_at <= ?');           params.push(req.query.to); }
    if (req.query.salesperson_id)  { filters.push('c.activated_by_salesperson = ?'); params.push(req.query.salesperson_id); }
    if (req.query.plan_id)         { filters.push('c.plan_id = ?');                  params.push(req.query.plan_id); }
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : `WHERE 1=1`;
    const [rows] = await pool.execute(
      `SELECT c.card_number, c.activated_at, c.expires_at, c.amount_paid, c.status,
              p.name AS plan_name, p.is_corporate, p.corporate_client_name,
              cu.full_name AS customer_name, cu.phone AS customer_phone,
              sp.full_name AS salesperson_name, sp.phone AS salesperson_phone
         FROM cards c
         JOIN plans p ON p.id = c.plan_id
    LEFT JOIN users cu ON cu.id = c.customer_id
    LEFT JOIN users sp ON sp.id = c.activated_by_salesperson
         ${where} AND c.status IN ('active','expired')
        ORDER BY c.activated_at DESC LIMIT 10000`,
      params
    );
    if (req.query.format === 'csv') return sendCSV(res, 'sales_report', rows);
    res.json({ rows });
  } catch (e) { next(e); }
});

router.get('/reports/coupons', async (req, res, next) => {
  try {
    const filters = [], params = [];
    if (req.query.status)       { filters.push('cp.status = ?');       params.push(req.query.status); }
    if (req.query.benefit_code) { filters.push('cp.benefit_code = ?'); params.push(req.query.benefit_code); }
    if (req.query.from)         { filters.push('cp.created_at >= ?');  params.push(req.query.from); }
    if (req.query.to)           { filters.push('cp.created_at <= ?');  params.push(req.query.to); }
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const [rows] = await pool.execute(
      `SELECT cp.coupon_code, cp.benefit_code, cp.benefit_name, cp.status, cp.used_at, cp.expires_at, cp.created_at,
              cd.card_number, cu.full_name AS customer_name, cu.phone AS customer_phone
         FROM coupons cp
         JOIN cards cd ON cd.id = cp.card_id
         JOIN users cu ON cu.id = cp.customer_id
         ${where}
        ORDER BY cp.created_at DESC LIMIT 10000`,
      params
    );
    if (req.query.format === 'csv') return sendCSV(res, 'coupons_report', rows);
    res.json({ rows });
  } catch (e) { next(e); }
});

// Re-prove the admin password (used by the web panel to mount the reception view).
router.post('/verify-password', body('password').isString(), async (req, res, next) => {
  try {
    const [rows] = await pool.execute('SELECT password_hash FROM users WHERE id = ? LIMIT 1', [req.user.id]);
    if (rows.length === 0) return res.status(401).json({ ok: false });
    const ok = await verifyPassword(req.body.password, rows[0].password_hash);
    res.json({ ok });
  } catch (e) { next(e); }
});

// Change admin password.
router.post('/change-password',
  body('current_password').isString(),
  body('new_password').isString().isLength({ min: 6 }),
  async (req, res, next) => {
    try {
      const [rows] = await pool.execute('SELECT password_hash FROM users WHERE id = ? LIMIT 1', [req.user.id]);
      const ok = await verifyPassword(req.body.current_password, rows[0].password_hash);
      if (!ok) return res.status(401).json({ error: 'invalid_current_password' });
      await pool.execute('UPDATE users SET password_hash = ? WHERE id = ?', [await hashPassword(req.body.new_password), req.user.id]);
      res.json({ ok: true });
    } catch (e) { next(e); }
  }
);

module.exports = router;
