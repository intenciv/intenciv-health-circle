/**
 * OTP helpers — 4-digit numeric OTP, SHA-256 hashing, 10-minute expiry.
 * The plain OTP must NEVER be stored. Only the hash goes to otp_log.
 */
const crypto = require('crypto');

const OTP_TTL_MINUTES   = 10;
const OTP_MAX_ATTEMPTS  = 3;
const OTP_RATE_WINDOW_M = 60;
const OTP_RATE_MAX      = 3;

function generate() {
  // Math.random is fine functionally, but use crypto for unpredictability.
  const n = crypto.randomInt(0, 10000);
  return String(n).padStart(4, '0');
}

function hash(otp) {
  return crypto.createHash('sha256').update(String(otp)).digest('hex');
}

function expiryDate() {
  return new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
}

module.exports = {
  generate,
  hash,
  expiryDate,
  OTP_TTL_MINUTES,
  OTP_MAX_ATTEMPTS,
  OTP_RATE_WINDOW_M,
  OTP_RATE_MAX,
};
