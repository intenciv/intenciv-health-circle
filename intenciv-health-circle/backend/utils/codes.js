/**
 * Coupon + activation code generators.
 * - Activation code : ACT-XXXXX  (5 uppercase alphanumerics)
 * - Coupon code     : [TEST_ABBR]-[4 uppercase alphanumerics]
 *   TEST_ABBR is the first letters of the first 3 alphabetic words
 *   of the test name (or the first 3 letters of one word), uppercase.
 */
const crypto = require('crypto');

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I

function randomChunk(len) {
  let out = '';
  const bytes = crypto.randomBytes(len);
  for (let i = 0; i < len; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

function activationCode() {
  return `ACT-${randomChunk(5)}`;
}

function testAbbreviation(testName) {
  // Strip non-alpha, take significant tokens.
  const tokens = String(testName)
    .replace(/[^A-Za-z\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (tokens.length === 0) return 'TST';

  // Multi-word: first letter of up to 3 words.
  if (tokens.length >= 2) {
    return tokens.slice(0, 3).map(t => t[0]).join('').toUpperCase();
  }
  // Single word: first 3 letters.
  return tokens[0].slice(0, 3).toUpperCase();
}

function couponCode(testName) {
  return `${testAbbreviation(testName)}-${randomChunk(4)}`;
}

module.exports = { activationCode, couponCode, testAbbreviation };
