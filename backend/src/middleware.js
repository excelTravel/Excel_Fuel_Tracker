/**
 * middleware.js — Express middleware for authentication guards
 */

const { verifyToken } = require('./auth');

/** Require a valid JWT in the Authorization: Bearer <token> header. */
function requireLogin(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ ok: false, error: 'Not authenticated.' });
  }

  try {
    req.user = verifyToken(token); // { id, name, email, role }
    next();
  } catch {
    return res.status(401).json({ ok: false, error: 'Invalid or expired session.' });
  }
}

/** Require the authenticated user to have the admin role. */
function requireAdmin(req, res, next) {
  requireLogin(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ ok: false, error: 'Admin access required.' });
    }
    next();
  });
}

module.exports = { requireLogin, requireAdmin };
