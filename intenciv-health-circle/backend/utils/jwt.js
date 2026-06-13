/**
 * JWT helpers — access (7d) + refresh (30d).
 * Payload contains only { id, role } per the security spec.
 */
const jwt = require('jsonwebtoken');

const ACCESS_EXPIRES  = process.env.JWT_EXPIRES_IN || '7d';
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES_IN || '30d';

function signAccess(user) {
  return jwt.sign(
    { id: user.id, role: user.role, type: 'access' },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_EXPIRES }
  );
}

function signRefresh(user) {
  return jwt.sign(
    { id: user.id, role: user.role, type: 'refresh' },
    process.env.JWT_SECRET,
    { expiresIn: REFRESH_EXPIRES }
  );
}

function verify(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

module.exports = { signAccess, signRefresh, verify };
