/**
 * Authentication middleware — verifies the JWT access token and
 * attaches `req.user = { id, role }`.
 *
 * requireRole(...roles) returns a middleware that 403s when the
 * authenticated user's role isn't in the allowed set.
 */
const { verify } = require('../utils/jwt');

function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'missing_token' });

  try {
    const decoded = verify(token);
    if (decoded.type && decoded.type !== 'access') {
      return res.status(401).json({ error: 'invalid_token_type' });
    }
    req.user = { id: decoded.id, role: decoded.role };
    next();
  } catch (_err) {
    return res.status(401).json({ error: 'invalid_or_expired_token' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'unauthenticated' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'forbidden_role' });
    }
    next();
  };
}

module.exports = { authenticate, requireRole };
