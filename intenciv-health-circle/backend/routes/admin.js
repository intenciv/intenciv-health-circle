/**
 * Admin routes — role: admin.
 *
 *   POST /admin/tiers
 *   PUT  /admin/tiers/:id
 *   POST /admin/activation-codes
 *   GET  /admin/reports/sales         (?from, ?to, ?agent_id, ?tier_id, ?format=csv)
 *   GET  /admin/reports/coupons       (?status, ?test, ?from, ?to, ?format=csv)
 *   POST /admin/users
 *   PUT  /admin/users/:id/toggle
 *   GET  /admin/dashboard
 *   GET  /admin/tiers
 *   GET  /admin/activation-codes
 *   GET  /admin/users
 */
const express = require('express');
const { body, validationResult, query } = require('express-validator');
const { v4: uuidv4 } = require('uuid');

const { pool } = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');
const { activationCode } = require('../utils/codes');

const router = express.Router();

router.use(authenticate, requireRole('admin'));

// ---------- helpers ----------
function bail(res, errors) {
  return res.status(400).json({ error: 'validation_failed', details: errors.array() });
}
function csvCell(val) {
  if (val === null || val === undefined) return '';
  const s = String(val);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCSV(rows) {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  for (const r of rows) lines.push(headers.map(h => csvCell(r[h])).join(','));
  return lines.join('\n');
}
function sendCSV(res, name, rows) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${name}.csv"`);
  res.send(toCSV(rows));
}

// ---------- dashboard ----------
router.get('/dashboard', async (_req, res, next) => {
  try {
    const [[booklets]] = await pool.execute('SELECT COUNT(*) AS c FROM booklets');
    const [[activeCoupons]] = await pool.execute(`SELECT COUNT(*) AS c FROM coupons WHERE status = 'active'`);
    const [[availedCoupons]] = await pool.execute(`SELECT COUNT(*) AS c FROM coupons WHERE status = 'availed'`);
    const [[todayActivations]] = await pool.execute(
      `SELECT COUNT(*) AS c FROM booklets WHERE DATE(activated_at) = CURDATE()`
    );
    const [[agents]] = await pool.execute(`SELECT COUNT(*) AS c FROM users WHERE role = 'sales_agent' AND is_active = 1`);
    const [[receptionists]] = await pool.execute(`SELECT COUNT(*) AS c FROM users WHERE role = 'receptionist' AND is_active = 1`);
    const [[clients]] = await pool.execute(`SELECT COUNT(*) AS c FROM users WHERE role = 'client'`);

    res.json({
      total_booklets:       booklets.c,
      active_coupons:       activeCoupons.c,
      availed_coupons:      availedCoupons.c,
      today_activations:    todayActivations.c,
      agents_count:         agents.c,
      receptionists_count:  receptionists.c,
      clients_count:        clients.c,
    });
  } catch (err) { next(err); }
});

// ---------- tiers ----------
router.get('/tiers', async (_req, res, next) => {
  try {
    const [tiers] = await pool.execute(
      `SELECT id, name, price, description, validity_days, is_active, created_at
         FROM booklet_tiers ORDER BY price ASC`
    );
    const [tests] = await pool.execute(
      `SELECT id, tier_id, test_name, original_price, discounted_price, sort_order
         FROM tier_tests ORDER BY tier_id, sort_order ASC`
    );
    const byTier = {};
    for (const t of tests) {
      (byTier[t.tier_id] ||= []).push(t);
    }
    res.json({ tiers: tiers.map(t => ({ ...t, tests: byTier[t.id] || [] })) });
  } catch (err) { next(err); }
});

router.post(
  '/tiers',
  body('name').isString().notEmpty(),
  body('price').isFloat({ min: 0 }),
  body('description').optional({ nullable: true }).isString(),
  body('validity_days').optional().isInt({ min: 1 }),
  body('tests').isArray({ min: 1 }),
  body('tests.*.test_name').isString().notEmpty(),
  body('tests.*.original_price').isFloat({ min: 0 }),
  body('tests.*.discounted_price').isFloat({ min: 0 }),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return bail(res, errors);

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const id = uuidv4();
      await conn.execute(
        `INSERT INTO booklet_tiers (id, name, price, description, validity_days, is_active, created_at)
         VALUES (?, ?, ?, ?, ?, 1, NOW())`,
        [id, req.body.name, req.body.price, req.body.description ?? null, req.body.validity_days || 365]
      );
      for (let i = 0; i < req.body.tests.length; i++) {
        const t = req.body.tests[i];
        await conn.execute(
          `INSERT INTO tier_tests (id, tier_id, test_name, original_price, discounted_price, sort_order)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [uuidv4(), id, t.test_name, t.original_price, t.discounted_price, i + 1]
        );
      }
      await conn.commit();
      res.status(201).json({ id });
    } catch (err) {
      await conn.rollback().catch(() => {});
      next(err);
    } finally {
      conn.release();
    }
  }
);

router.put(
  '/tiers/:id',
  body('name').optional().isString().notEmpty(),
  body('price').optional().isFloat({ min: 0 }),
  body('description').optional({ nullable: true }).isString(),
  body('validity_days').optional().isInt({ min: 1 }),
  body('is_active').optional().isBoolean(),
  body('tests').optional().isArray(),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return bail(res, errors);

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const fields = ['name', 'price', 'description', 'validity_days', 'is_active'];
      const sets = [];
      const params = [];
      for (const f of fields) {
        if (Object.prototype.hasOwnProperty.call(req.body, f)) {
          sets.push(`\`${f}\` = ?`);
          params.push(req.body[f]);
        }
      }
      if (sets.length > 0) {
        params.push(req.params.id);
        await conn.execute(`UPDATE booklet_tiers SET ${sets.join(', ')} WHERE id = ?`, params);
      }

      if (Array.isArray(req.body.tests)) {
        await conn.execute(`DELETE FROM tier_tests WHERE tier_id = ?`, [req.params.id]);
        for (let i = 0; i < req.body.tests.length; i++) {
          const t = req.body.tests[i];
          await conn.execute(
            `INSERT INTO tier_tests (id, tier_id, test_name, original_price, discounted_price, sort_order)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [uuidv4(), req.params.id, t.test_name, t.original_price, t.discounted_price, i + 1]
          );
        }
      }

      await conn.commit();
      res.json({ ok: true });
    } catch (err) {
      await conn.rollback().catch(() => {});
      next(err);
    } finally {
      conn.release();
    }
  }
);

// ---------- activation codes ----------
router.get('/activation-codes', async (req, res, next) => {
  try {
    const filters = [];
    const params = [];
    if (req.query.tier_id) { filters.push('ac.tier_id = ?'); params.push(req.query.tier_id); }
    if (req.query.agent_id) { filters.push('ac.assigned_agent_id = ?'); params.push(req.query.agent_id); }
    if (req.query.status === 'used')   filters.push('ac.is_used = 1');
    if (req.query.status === 'unused') filters.push('ac.is_used = 0');
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const [rows] = await pool.execute(
      `SELECT ac.id, ac.code, ac.tier_id, t.name AS tier_name,
              ac.assigned_agent_id, a.full_name AS agent_name, a.phone AS agent_phone,
              ac.is_used, ac.used_at, ac.used_by_agent_id, ac.created_at
         FROM activation_codes ac
         JOIN booklet_tiers t ON t.id = ac.tier_id
    LEFT JOIN users a ON a.id = ac.assigned_agent_id
         ${where}
        ORDER BY ac.created_at DESC
        LIMIT 5000`,
      params
    );

    if (req.query.format === 'csv') return sendCSV(res, 'activation_codes', rows);
    res.json({ codes: rows });
  } catch (err) { next(err); }
});

router.post(
  '/activation-codes',
  body('tier_id').isString().notEmpty(),
  body('count').isInt({ min: 1, max: 1000 }),
  body('agent_id').optional({ nullable: true }).isString(),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return bail(res, errors);

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [tier] = await conn.execute('SELECT id FROM booklet_tiers WHERE id = ? LIMIT 1', [req.body.tier_id]);
      if (tier.length === 0) {
        await conn.rollback();
        return res.status(400).json({ error: 'tier_not_found' });
      }
      if (req.body.agent_id) {
        const [agent] = await conn.execute(
          `SELECT id FROM users WHERE id = ? AND role = 'sales_agent' AND is_active = 1 LIMIT 1`,
          [req.body.agent_id]
        );
        if (agent.length === 0) {
          await conn.rollback();
          return res.status(400).json({ error: 'agent_not_found' });
        }
      }

      const created = [];
      for (let i = 0; i < req.body.count; i++) {
        let inserted = false;
        let attempts = 0;
        while (!inserted && attempts < 5) {
          attempts++;
          const code = activationCode();
          try {
            const id = uuidv4();
            await conn.execute(
              `INSERT INTO activation_codes
                  (id, code, tier_id, assigned_agent_id, is_used, created_by_admin_id, created_at)
               VALUES (?, ?, ?, ?, 0, ?, NOW())`,
              [id, code, req.body.tier_id, req.body.agent_id || null, req.user.id]
            );
            created.push({ id, code });
            inserted = true;
          } catch (err) {
            if (err.code !== 'ER_DUP_ENTRY') throw err;
          }
        }
        if (!inserted) throw new Error('activation_code_collision');
      }

      await conn.commit();
      res.status(201).json({ created });
    } catch (err) {
      await conn.rollback().catch(() => {});
      next(err);
    } finally {
      conn.release();
    }
  }
);

// ---------- users ----------
router.get('/users', async (req, res, next) => {
  try {
    const filters = [];
    const params = [];
    if (req.query.role) { filters.push('role = ?'); params.push(req.query.role); }
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const [rows] = await pool.execute(
      `SELECT id, phone, full_name, email, role, is_active, created_at, last_login
         FROM users ${where}
        ORDER BY created_at DESC LIMIT 2000`,
      params
    );
    res.json({ users: rows });
  } catch (err) { next(err); }
});

router.post(
  '/users',
  body('phone').isString().notEmpty(),
  body('role').isIn(['sales_agent', 'receptionist', 'admin']),
  body('full_name').isString().isLength({ min: 2 }),
  body('email').optional({ nullable: true }).isEmail(),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return bail(res, errors);

    try {
      const digits = String(req.body.phone).replace(/\D/g, '');
      let phone = req.body.phone;
      if (digits.length === 10) phone = `+91${digits}`;
      else if (digits.length === 12 && digits.startsWith('91')) phone = `+${digits}`;
      else return res.status(400).json({ error: 'invalid_phone' });

      const [exists] = await pool.execute('SELECT id FROM users WHERE phone = ? LIMIT 1', [phone]);
      if (exists.length > 0) return res.status(409).json({ error: 'phone_already_registered' });

      const id = uuidv4();
      await pool.execute(
        `INSERT INTO users (id, phone, full_name, email, role, is_active, created_at)
         VALUES (?, ?, ?, ?, ?, 1, NOW())`,
        [id, phone, req.body.full_name, req.body.email || null, req.body.role]
      );
      res.status(201).json({ id, phone, role: req.body.role });
    } catch (err) { next(err); }
  }
);

router.put('/users/:id/toggle', async (req, res, next) => {
  try {
    const [rows] = await pool.execute('SELECT id, is_active FROM users WHERE id = ? LIMIT 1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'user_not_found' });
    const next_state = rows[0].is_active ? 0 : 1;
    await pool.execute('UPDATE users SET is_active = ? WHERE id = ?', [next_state, req.params.id]);
    res.json({ ok: true, is_active: Boolean(next_state) });
  } catch (err) { next(err); }
});

// ---------- reports ----------
router.get(
  '/reports/sales',
  query('from').optional().isISO8601(),
  query('to').optional().isISO8601(),
  async (req, res, next) => {
    try {
      const filters = [];
      const params = [];
      if (req.query.from) { filters.push('b.activated_at >= ?'); params.push(req.query.from); }
      if (req.query.to)   { filters.push('b.activated_at <= ?'); params.push(req.query.to); }
      if (req.query.agent_id) { filters.push('b.sold_by_agent_id = ?'); params.push(req.query.agent_id); }
      if (req.query.tier_id)  { filters.push('b.tier_id = ?');           params.push(req.query.tier_id); }
      const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

      const [rows] = await pool.execute(
        `SELECT b.id AS booklet_id, b.activated_at, b.expires_at, b.amount_paid,
                b.activation_code_used, b.status,
                t.name AS tier_name,
                u.full_name AS client_name, u.phone AS client_phone,
                a.full_name AS agent_name, a.phone AS agent_phone
           FROM booklets b
           JOIN booklet_tiers t ON t.id = b.tier_id
           JOIN users u ON u.id = b.client_id
           JOIN users a ON a.id = b.sold_by_agent_id
           ${where}
          ORDER BY b.activated_at DESC LIMIT 10000`,
        params
      );

      if (req.query.format === 'csv') return sendCSV(res, 'sales_report', rows);
      res.json({ rows });
    } catch (err) { next(err); }
  }
);

router.get('/reports/coupons', async (req, res, next) => {
  try {
    const filters = [];
    const params = [];
    if (req.query.status) { filters.push('c.status = ?'); params.push(req.query.status); }
    if (req.query.test)   { filters.push('c.test_name LIKE ?'); params.push(`%${req.query.test}%`); }
    if (req.query.from)   { filters.push('c.created_at >= ?'); params.push(req.query.from); }
    if (req.query.to)     { filters.push('c.created_at <= ?'); params.push(req.query.to); }
    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const [rows] = await pool.execute(
      `SELECT c.coupon_code, c.test_name, c.original_price, c.discounted_price, c.discount_percent,
              c.status, c.availed_at, c.expires_at, c.created_at,
              u.full_name AS client_name, u.phone AS client_phone,
              r.full_name AS availed_by_name
         FROM coupons c
         JOIN users u ON u.id = c.client_id
    LEFT JOIN users r ON r.id = c.availed_by_receptionist_id
         ${where}
        ORDER BY c.created_at DESC LIMIT 10000`,
      params
    );
    if (req.query.format === 'csv') return sendCSV(res, 'coupons_report', rows);
    res.json({ rows });
  } catch (err) { next(err); }
});

module.exports = router;
