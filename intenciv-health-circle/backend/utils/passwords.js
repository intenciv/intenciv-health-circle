/**
 * Bcrypt helpers for the admin password and salesperson 4-digit PIN.
 * PINs are always hashed before storage — never stored in plain text.
 */
const bcrypt = require('bcryptjs');

const PASSWORD_COST = 10;
const PIN_COST = 10;

async function hashPassword(plain) {
  return bcrypt.hash(String(plain), PASSWORD_COST);
}
async function verifyPassword(plain, hash) {
  if (!hash) return false;
  return bcrypt.compare(String(plain), hash);
}
async function hashPin(plain) {
  return bcrypt.hash(String(plain), PIN_COST);
}
async function verifyPin(plain, hash) {
  if (!hash) return false;
  return bcrypt.compare(String(plain), hash);
}

function isValidPin(pin) {
  return /^\d{4}$/.test(String(pin || ''));
}

// Admin password policy, harmonized with HRM/IVS/CRM: minimum 8 characters,
// at least one capital letter, one special character, and one numeral.
function isValidPassword(pwd) {
  const s = String(pwd || '');
  return s.length >= 8
    && /[A-Z]/.test(s)
    && /[0-9]/.test(s)
    && /[^A-Za-z0-9]/.test(s);
}

module.exports = { hashPassword, verifyPassword, hashPin, verifyPin, isValidPin, isValidPassword };
