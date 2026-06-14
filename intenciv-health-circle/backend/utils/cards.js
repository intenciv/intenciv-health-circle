/**
 * Card number + coupon code generators.
 *
 *   Card number : IHC-YYYY-NNNNN     (e.g. IHC-2025-00341)
 *   Coupon code : IHC-CPN-NNNNN-XXNN (e.g. IHC-CPN-00341-HC01)
 *
 * Card sequence is allocated inside the DB transaction by reading and
 * incrementing card_sequence(year). Concurrent admins are serialised by
 * SELECT … FOR UPDATE in routes/admin.js.
 */

function cardNumber(year, seq) {
  const s = String(seq).padStart(5, '0');
  return `IHC-${year}-${s}`;
}

function couponCode(cardSeq, benefitCode, sequence) {
  const cs = String(cardSeq).padStart(5, '0');
  const sq = String(sequence).padStart(2, '0');
  return `IHC-CPN-${cs}-${benefitCode}${sq}`;
}

/** Allocate `count` sequential card sequences for the current year inside a transaction. */
async function allocateCardSequences(conn, count) {
  const year = new Date().getUTCFullYear();
  await conn.execute(
    `INSERT INTO card_sequence (year_part, last_seq) VALUES (?, 0)
     ON DUPLICATE KEY UPDATE year_part = year_part`,
    [year]
  );
  const [rows] = await conn.execute(
    `SELECT last_seq FROM card_sequence WHERE year_part = ? FOR UPDATE`,
    [year]
  );
  const from = rows[0].last_seq + 1;
  const to   = rows[0].last_seq + count;
  await conn.execute(`UPDATE card_sequence SET last_seq = ? WHERE year_part = ?`, [to, year]);
  const seqs = [];
  for (let s = from; s <= to; s++) seqs.push({ year, seq: s, number: cardNumber(year, s) });
  return seqs;
}

module.exports = { cardNumber, couponCode, allocateCardSequences };
