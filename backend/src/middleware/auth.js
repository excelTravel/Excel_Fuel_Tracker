const jwt = require('jsonwebtoken');
const { readDb } = require('../db');

/** Requires a valid Bearer token; attaches req.user = { id, name, email, role } */
function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ ok: false, error: 'Missing or invalid authorization token.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const db = readDb();
    const user = db.users.find(u => u.id === payload.sub);
    if (!user) {
      return res.status(401).json({ ok: false, error: 'User no longer exists.' });
    }
    req.user = { id: user.id, name: user.name, email: user.email, role: user.role, station: user.station || null };
    next();
  } catch {
    return res.status(401).json({ ok: false, error: 'Session expired. Please sign in again.' });
  }
}

/** Use after authRequired — rejects non-admins. */
function adminRequired(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ ok: false, error: 'Admin access required.' });
  }
  next();
}

module.exports = { authRequired, adminRequired };