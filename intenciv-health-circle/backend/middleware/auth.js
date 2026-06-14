/**
 * Auth middleware (revised).
 *
 * Three roles: admin, salesperson, customer.
 * Tokens carry { id, role, type:'access'|'refresh'|'activation' }.
 *
 * Activation tokens are short-lived (10 min) and represent a verified
 * OTP — they are used as the second factor alongside the salesperson's
 * PIN in /salesperson/activate-card.
 */
const { verify } = require('../utils/jwt');

function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'missing_token' });
  try {
    const decoded = verify(token);
    if (decoded.type && !['access'].includes(decoded.type)) {
      return res.status(401).json({ error: 'invalid_token_type' });
    }
    req.user = { id: decoded.id, role: decoded.role };
    next();
  } catch (_e) {
    return res.status(401).json({ error: 'invalid_or_expired_token' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'unauthenticated' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'forbidden_role' });
    next();
  };
}

/**
 * Reception-desk gate: an authenticated admin must additionally re-prove
 * their password via the `x-admin-password` header on every reception
 * lookup/avail call. This satisfies "Reception is admin-password protected".
 */
async function requireAdminPassword(req, res, next) {
  try {
    const password = req.headers['x-admin-password'];
    if (!password) return res.status(401).json({ error: 'admin_password_required' });

    const { pool } = require('../config/db');
    const { verifyPassword } = require('../utils/passwords');
    const [rows] = await pool.execute(
      `SELECT password_hash FROM users WHERE id = ? AND role = 'admin' AND is_active = 1 LIMIT 1`,
      [req.user.id]
    );
    if (rows.length === 0) return res.status(403).json({ error: 'admin_not_found' });
    const ok = await verifyPassword(password, rows[0].password_hash);
    if (!ok) return res.status(401).json({ error: 'admin_password_incorrect' });
    next();
  } catch (e) { next(e); }
}

module.exports = { authenticate, requireRole, requireAdminPassword };
