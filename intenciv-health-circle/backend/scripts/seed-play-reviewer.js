/**
 * One-off setup for the Google Play reviewer account.
 *
 * Creates (or reuses) a 'customer' user at PLAY_REVIEWER_PHONE with an
 * active card on your existing Standard plan, so the fixed-OTP bypass in
 * routes/auth.js (PLAY_REVIEWER_PHONE / PLAY_REVIEWER_OTP) has something
 * real to log into.
 *
 * Run from the backend/ folder, wherever DB_HOST/DB_USER/DB_PASSWORD/DB_NAME
 * (and PLAY_REVIEWER_PHONE) are set — e.g. `railway run node scripts/seed-play-reviewer.js`
 * or with a local .env pointed at the same database your API uses.
 *
 * Safe to run more than once — it upserts, it does not duplicate.
 */
require('dotenv').config();
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/db');

const PHONE = process.env.PLAY_REVIEWER_PHONE;

function normalisePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  return null;
}

async function main() {
  if (!PHONE) {
    console.error('Set PLAY_REVIEWER_PHONE before running this script (same value as in your API env).');
    process.exit(1);
  }
  const phone = normalisePhone(PHONE) || PHONE;

  const [existing] = await pool.execute(
    `SELECT id FROM users WHERE phone = ? LIMIT 1`, [phone]
  );

  let customerId;
  if (existing.length) {
    customerId = existing[0].id;
    await pool.execute(
      `UPDATE users SET role = 'customer', is_active = 1, full_name = 'Play Store Reviewer' WHERE id = ?`,
      [customerId]
    );
    console.log(`Reused existing user #${customerId} (${phone}) — set role=customer, active.`);
  } else {
    customerId = uuidv4();
    await pool.execute(
      `INSERT INTO users (id, role, phone, full_name, is_active, created_at)
       VALUES (?, 'customer', ?, 'Play Store Reviewer', 1, NOW())`,
      [customerId, phone]
    );
    console.log(`Created customer #${customerId} (${phone}).`);
  }

  const [activeCard] = await pool.execute(
    `SELECT id FROM cards WHERE customer_id = ? AND status = 'active' LIMIT 1`, [customerId]
  );
  if (activeCard.length) {
    console.log(`Already has an active card (#${activeCard[0].id}) — nothing more to do.`);
    await pool.end();
    return;
  }

  const [[plan]] = await pool.execute(
    `SELECT id FROM plans WHERE is_active = 1 ORDER BY created_at ASC LIMIT 1`
  );
  if (!plan) {
    console.error('No active plan found in `plans` — seed a plan first (see database/002_seed_tiers.sql).');
    process.exit(1);
  }

  const [[admin]] = await pool.execute(
    `SELECT id FROM users WHERE role = 'admin' AND is_active = 1 ORDER BY created_at ASC LIMIT 1`
  );
  if (!admin) {
    console.error('No active admin user found — needed as cards.created_by_admin.');
    process.exit(1);
  }

  const [[seqRow]] = await pool.execute(`SELECT COALESCE(MAX(card_seq), 0) + 1 AS next_seq FROM cards`);
  const cardSeq   = seqRow.next_seq;
  const cardId    = uuidv4();
  const cardNumber = `IHC-REVIEW-${String(cardSeq).padStart(5, '0')}`;

  await pool.execute(
    `INSERT INTO cards
       (id, card_number, card_seq, plan_id, status, customer_id, activated_at, expires_at, amount_paid, created_by_admin, created_at)
     VALUES (?, ?, ?, ?, 'active', ?, NOW(), DATE_ADD(NOW(), INTERVAL 5 YEAR), 0, ?, NOW())`,
    [cardId, cardNumber, cardSeq, plan.id, customerId, admin.id]
  );
  console.log(`Created active card ${cardNumber} (#${cardId}) for customer #${customerId}, expiring in 5 years.`);

  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
