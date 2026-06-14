/**
 * Salesperson routes.
 *
 *   GET  /salesperson/dashboard                       — KPIs
 *   GET  /salesperson/my-cards                        — list cards assigned to me
 *   POST /salesperson/activation/send-otp             { card_id, customer_phone }
 *   POST /salesperson/activation/verify-otp           { card_id, customer_phone, otp }  → activation_token
 *   POST /salesperson/activation/finalize             { card_id, customer_name, customer_phone, activation_token, pin }
 *
 * Security model:
 *   - The customer OTP only proves the mobile is reachable.
 *   - The salesperson's PIN (re-prompted in /finalize) is the real
 *     authorisation gate — without it, no card can ever be activated.
 */
const express = require('express');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

const { pool } = require('../config/db');
const { authenticate, requireRole } = require('../middleware/auth');
const { otpLimiter } = require('../middleware/rateLimit');
const { signActivation, verify } = require('../utils/jwt');
const { verifyPin } = require('../utils/passwords');
const { couponCode } = require('../utils/cards');
const authkey = require('../services/authkey');

const router = express.Router();
router.use(authenticate, requireRole('salesperson'));

function bail(res, errors) { return res.status(400).json({ error: 'validation_failed', details: errors.array() }); }
function normalisePhone(raw) {
  const d = String(raw || '').replace(/\D/g, '');
  if (d.length === 10) return `+91${d}`;
  if (d.length === 12 && d.startsWith('91')) return `+${d}`;
  return null;
}
const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

// ---------- dashboard ----------
router.get('/dashboard', async (req, res, next) => {
  try {
    const [[today]]  = await pool.execute(
      `SELECT COUNT(*) AS c FROM cards WHERE activated_by_salesperson = ? AND status = 'active' AND DATE(activated_at) = CURDATE()`,
      [req.user.id]
    );
    const [[month]]  = await pool.execute(
      `SELECT COUNT(*) AS c FROM cards WHERE activated_by_salesperson = ? AND status = 'active' AND YEAR(activated_at)=YEAR(CURDATE()) AND MONTH(activated_at)=MONTH(CURDATE())`,
      [req.user.id]
    );
    const [[total]]  = await pool.execute(
      `SELECT COUNT(*) AS c FROM cards WHERE activated_by_salesperson = ? AND status IN ('active','expired')`,
      [req.user.id]
    );
    const [[unused]] = await pool.execute(
      `SELECT COUNT(*) AS c FROM cards WHERE assigned_to_salesperson = ? AND status IN ('unused','assigned')`,
      [req.user.id]
    );
    res.json({
      today_count: today.c, month_count: month.c, total_count: total.c, unused_assigned: unused.c,
    });
  } catch (e) { next(e); }
});

// ---------- list cards ----------
router.get('/my-cards', async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT c.id, c.card_number, c.card_seq, c.status, c.activated_at, c.expires_at, c.amount_paid,
              p.name AS plan_name, p.price AS plan_price,
              cust.full_name AS customer_name, cust.phone AS customer_phone
         FROM cards c
         JOIN plans p ON p.id = c.plan_id
    LEFT JOIN users cust ON cust.id = c.customer_id
        WHERE c.assigned_to_salesperson = ? OR c.activated_by_salesperson = ?
        ORDER BY (c.status IN ('unused','assigned')) DESC, c.activated_at DESC, c.card_number ASC
        LIMIT 1000`,
      [req.user.id, req.user.id]
    );
    res.json({ cards: rows });
  } catch (e) { next(e); }
});

// ---------- activation: step 1 - send OTP ----------
router.post(
  '/activation/send-otp',
  otpLimiter,
  body('card_id').isString().notEmpty(),
  body('customer_phone').isString().notEmpty(),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return bail(res, errors);

    try {
      const phone = normalisePhone(req.body.customer_phone);
      if (!phone) return res.status(400).json({ error: 'invalid_phone' });

      const [rows] = await pool.execute(
        `SELECT id, status FROM cards
          WHERE id = ? AND assigned_to_salesperson = ?
          LIMIT 1`,
        [req.body.card_id, req.user.id]
      );
      if (rows.length === 0) return res.status(404).json({ error: 'card_not_assigned_to_you' });
      if (!['unused', 'assigned'].includes(rows[0].status)) {
        return res.status(409).json({ error: 'card_not_activatable' });
      }

      // AuthKey template uses a 6-digit OTP placeholder ({#2fa#}).
      const otp = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      await pool.execute(
        `UPDATE otp_log SET is_verified = 1 WHERE phone = ? AND is_verified = 0`,
        [phone]
      );
      await pool.execute(
        `INSERT INTO otp_log (id, phone, otp_hash, purpose, expires_at)
         VALUES (?, ?, ?, 'activation', ?)`,
        [uuidv4(), phone, sha256(otp), expiresAt]
      );

      const gw = await authkey.sendOtp({ phone, otp }).catch(err => ({ gateway_error: true, message: err.message }));
      res.json({ ok: true, gateway: gw, expires_in_seconds: 600 });
    } catch (e) { next(e); }
  }
);

// ---------- activation: step 2 - verify OTP, return activation token ----------
router.post(
  '/activation/verify-otp',
  body('card_id').isString().notEmpty(),
  body('customer_phone').isString().notEmpty(),
  body('otp').isString().isLength({ min: 6, max: 6 }),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return bail(res, errors);

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const phone = normalisePhone(req.body.customer_phone);
      if (!phone) { await conn.rollback(); return res.status(400).json({ error: 'invalid_phone' }); }

      const [rows] = await conn.execute(
        `SELECT id, otp_hash, attempts FROM otp_log
          WHERE phone = ? AND is_verified = 0 AND expires_at > NOW()
          ORDER BY created_at DESC LIMIT 1`,
        [phone]
      );
      if (rows.length === 0) { await conn.rollback(); return res.status(400).json({ error: 'otp_not_found_or_expired' }); }
      const otpRow = rows[0];
      if (otpRow.attempts >= 3) {
        await conn.execute('UPDATE otp_log SET is_verified = 1 WHERE id = ?', [otpRow.id]);
        await conn.commit();
        return res.status(400).json({ error: 'otp_attempts_exhausted' });
      }
      if (sha256(req.body.otp) !== otpRow.otp_hash) {
        const next = otpRow.attempts + 1;
        await conn.execute(
          `UPDATE otp_log SET attempts = ?, is_verified = ? WHERE id = ?`,
          [next, next >= 3 ? 1 : 0, otpRow.id]
        );
        await conn.commit();
        return res.status(400).json({ error: 'otp_incorrect', attempts_left: Math.max(0, 3 - next) });
      }
      await conn.execute('UPDATE otp_log SET is_verified = 1 WHERE id = ?', [otpRow.id]);
      await conn.commit();

      const activation_token = signActivation({
        salesperson_id: req.user.id,
        card_id: req.body.card_id,
        customer_phone: phone,
      });
      res.json({ activation_token });
    } catch (e) {
      await conn.rollback().catch(() => {});
      next(e);
    } finally { conn.release(); }
  }
);

// ---------- activation: step 3 - finalize with salesperson PIN ----------
router.post(
  '/activation/finalize',
  body('activation_token').isString().notEmpty(),
  body('pin').isString().isLength({ min: 4, max: 4 }),
  body('customer_name').isString().isLength({ min: 2, max: 100 }),
  body('customer_phone').isString().notEmpty(),
  body('card_id').isString().notEmpty(),
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return bail(res, errors);

    // Decode activation token first
    let activation;
    try { activation = verify(req.body.activation_token); }
    catch (_e) { return res.status(401).json({ error: 'activation_token_invalid' }); }
    if (activation.type !== 'activation') return res.status(401).json({ error: 'activation_token_invalid' });
    if (activation.salesperson_id !== req.user.id) return res.status(403).json({ error: 'token_mismatch' });
    if (activation.card_id !== req.body.card_id) return res.status(400).json({ error: 'card_mismatch' });

    const phone = normalisePhone(req.body.customer_phone);
    if (!phone || phone !== activation.customer_phone) {
      return res.status(400).json({ error: 'phone_mismatch' });
    }

    // Verify salesperson's PIN (re-fetched from DB; never trust cached tokens).
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [sp] = await conn.execute(
        `SELECT pin_hash, is_active FROM users WHERE id = ? AND role = 'salesperson' LIMIT 1`,
        [req.user.id]
      );
      if (sp.length === 0 || !sp[0].is_active) {
        await conn.rollback(); return res.status(403).json({ error: 'salesperson_disabled' });
      }
      const pinOk = await verifyPin(req.body.pin, sp[0].pin_hash);
      if (!pinOk) { await conn.rollback(); return res.status(401).json({ error: 'pin_incorrect' }); }

      // Lock card row.
      const [cardRows] = await conn.execute(
        `SELECT id, card_number, card_seq, plan_id, status, assigned_to_salesperson
           FROM cards WHERE id = ? LIMIT 1 FOR UPDATE`,
        [req.body.card_id]
      );
      if (cardRows.length === 0)                              { await conn.rollback(); return res.status(404).json({ error: 'card_not_found' }); }
      const card = cardRows[0];
      if (card.assigned_to_salesperson !== req.user.id)       { await conn.rollback(); return res.status(403).json({ error: 'card_not_yours' }); }
      if (!['unused', 'assigned'].includes(card.status))      { await conn.rollback(); return res.status(409).json({ error: 'card_already_activated' }); }

      // Load plan + benefits.
      const [planRows] = await conn.execute(
        `SELECT id, name, price, validity_days, is_active FROM plans WHERE id = ? LIMIT 1`,
        [card.plan_id]
      );
      if (planRows.length === 0 || !planRows[0].is_active) {
        await conn.rollback(); return res.status(400).json({ error: 'plan_unavailable' });
      }
      const plan = planRows[0];

      const [benefits] = await conn.execute(
        `SELECT id, benefit_code, name, num_coupons FROM plan_benefits WHERE plan_id = ? ORDER BY sort_order ASC`,
        [plan.id]
      );
      if (benefits.length === 0) { await conn.rollback(); return res.status(400).json({ error: 'plan_has_no_benefits' }); }

      // Resolve / create customer user.
      const [existing] = await conn.execute(
        `SELECT id, role, is_active FROM users WHERE phone = ? LIMIT 1`,
        [phone]
      );
      let customerId;
      if (existing.length === 0) {
        customerId = uuidv4();
        await conn.execute(
          `INSERT INTO users (id, role, phone, full_name, is_active, created_at)
           VALUES (?, 'customer', ?, ?, 1, NOW())`,
          [customerId, phone, req.body.customer_name]
        );
      } else {
        if (existing[0].role !== 'customer') {
          await conn.rollback();
          return res.status(409).json({ error: 'phone_belongs_to_other_role' });
        }
        customerId = existing[0].id;
        await conn.execute(
          `UPDATE users SET full_name = ?, is_active = 1 WHERE id = ?`,
          [req.body.customer_name, customerId]
        );
      }

      // Activate card.
      const activatedAt = new Date();
      const expiresAt   = new Date(activatedAt.getTime() + plan.validity_days * 24 * 3600 * 1000);
      await conn.execute(
        `UPDATE cards
            SET status = 'active', customer_id = ?, activated_at = ?, expires_at = ?,
                activated_by_salesperson = ?, amount_paid = ?
          WHERE id = ?`,
        [customerId, activatedAt, expiresAt, req.user.id, plan.price, card.id]
      );

      // Generate coupons.
      const couponsCreated = [];
      for (const b of benefits) {
        for (let n = 1; n <= b.num_coupons; n++) {
          const code = couponCode(card.card_seq, b.benefit_code, n);
          const id = uuidv4();
          await conn.execute(
            `INSERT INTO coupons
                (id, coupon_code, card_id, customer_id, benefit_id, benefit_code, benefit_name,
                 status, expires_at, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'unused', ?, NOW())`,
            [id, code, card.id, customerId, b.id, b.benefit_code, b.name, expiresAt]
          );
          couponsCreated.push({ id, code, benefit_code: b.benefit_code, benefit_name: b.name });
        }
      }

      await conn.commit();

      // Welcome SMS (best-effort).
      authkey.sendWelcome({
        phone,
        tierName: plan.name,
        couponCount: couponsCreated.length,
        expiresAt,
      }).catch(() => {});

      res.status(201).json({
        ok: true,
        card: {
          id: card.id,
          card_number: card.card_number,
          plan_name: plan.name,
          customer_name: req.body.customer_name,
          customer_phone: phone,
          activated_at: activatedAt,
          expires_at: expiresAt,
          amount_paid: plan.price,
          total_coupons: couponsCreated.length,
        },
      });
    } catch (e) {
      await conn.rollback().catch(() => {});
      next(e);
    } finally { conn.release(); }
  }
);

module.exports = router;
