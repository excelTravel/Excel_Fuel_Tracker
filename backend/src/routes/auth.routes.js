const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { readDb, writeDb } = require('../db');
const { signToken, genResetToken } = require('../utils/token');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, role: u.role, station: u.station || null };
}

/** POST /api/auth/register — always creates an 'agent' account, tied to one station. */
router.post('/register', (req, res) => {
  const { name, email, password, station } = req.body || {};

  if (!name || !email || !password || !station) {
    return res.status(400).json({ ok: false, error: 'All fields are required.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ ok: false, error: 'Password must be at least 8 characters.' });
  }
  if (!['merez', 'rubis'].includes(station)) {
    return res.status(400).json({ ok: false, error: 'Please select a valid station.' });
  }

  const db = readDb();
  const normEmail = String(email).trim().toLowerCase();

  if (db.users.some(u => u.email.toLowerCase() === normEmail)) {
    return res.status(409).json({ ok: false, error: 'An account with this email already exists.' });
  }

  const user = {
    id: crypto.randomUUID(),
    name: String(name).trim(),
    email: normEmail,
    passwordHash: bcrypt.hashSync(password, 10),
    role: 'agent',
    station, // agents are permanently scoped to the station they register under
    resetToken: null,
    resetTokenExpires: null,
    createdAt: new Date().toISOString(),
  };

  db.users.push(user);
  writeDb(db);

  res.status(201).json({ ok: true, user: publicUser(user) });
});

/** POST /api/auth/login */
router.post('/login', (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ ok: false, error: 'Email and password are required.' });
  }

  const db = readDb();
  const user = db.users.find(u => u.email.toLowerCase() === String(email).trim().toLowerCase());

  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ ok: false, error: 'Invalid email or password.' });
  }

  const token = signToken(user);
  res.json({ ok: true, token, user: publicUser(user) });
});

/** GET /api/auth/me — used by the frontend to silently re-validate the token. */
router.get('/me', authRequired, (req, res) => {
  res.json({ ok: true, user: req.user });
});

/** POST /api/auth/forgot — generates a short-lived reset code. */
router.post('/forgot', (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ ok: false, error: 'Enter your email address.' });

  const db = readDb();
  const user = db.users.find(u => u.email.toLowerCase() === String(email).trim().toLowerCase());
  if (!user) {
    return res.status(404).json({ ok: false, error: 'No account found with that email.' });
  }

  const token = genResetToken();
  user.resetToken = token;
  user.resetTokenExpires = Date.now() + 15 * 60 * 1000; // 15 minutes
  writeDb(db);

  // NOTE: in production this code should be emailed to the user, not
  // returned in the API response. It's returned directly here only because
  // this project has no email/SMS provider wired up yet.
  res.json({ ok: true, token });
});

/** POST /api/auth/reset */
router.post('/reset', (req, res) => {
  const { token, newPassword } = req.body || {};

  if (!token || !newPassword) {
    return res.status(400).json({ ok: false, error: 'All fields are required.' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ ok: false, error: 'Password must be at least 8 characters.' });
  }

  const db = readDb();
  const normToken = String(token).trim().toUpperCase();
  const user = db.users.find(u => u.resetToken === normToken);

  if (!user || !user.resetTokenExpires || user.resetTokenExpires < Date.now()) {
    return res.status(400).json({ ok: false, error: 'Invalid or expired reset code.' });
  }

  user.passwordHash = bcrypt.hashSync(newPassword, 10);
  user.resetToken = null;
  user.resetTokenExpires = null;
  writeDb(db);

  res.json({ ok: true });
});

module.exports = router;