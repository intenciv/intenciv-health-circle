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
function isValidPassword(pwd) {
  return /^\d{6,}$/.test(String(pwd || '')) || (String(pwd || '').length >= 6);
}

module.exports = { hashPassword, verifyPassword, hashPin, verifyPin, isValidPin, isValidPassword };
