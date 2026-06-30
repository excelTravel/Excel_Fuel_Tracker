/**
 * routes/auth.routes.js — registration, login, password reset, session check
 */

const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { hashPassword, verifyPassword, signToken } = require('../auth');
const { requireLogin } = require('../middleware');

const router = express.Router();

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@exceltravel.rw').toLowerCase();

// ── POST /api/auth/register ────────────────────────────────────────────────
router.post('/register', (req, res) => {
  const { name, email, password } = req.body || {};

  if (!name || !email || !password) {
    return res.status(400).json({ ok: false, error: 'All fields are required.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ ok: false, error: 'Password must be at least 8 characters.' });
  }

  const emailLow = String(email).toLowerCase().trim();
  if (emailLow === ADMIN_EMAIL) {
    return res.status(400).json({ ok: false, error: 'This email is reserved.' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(emailLow);
  if (existing) {
    return res.status(409).json({ ok: false, error: 'An account with this email already exists.' });
  }

  const user = {
    id: 'u_' + crypto.randomUUID(),
    name: String(name).trim(),
    email: emailLow,
    password_hash: hashPassword(password),
    role: 'agent',
  };

  db.prepare(`
    INSERT INTO users (id, name, email, password_hash, role)
    VALUES (@id, @name, @email, @password_hash, @role)
  `).run(user);

  return res.json({ ok: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

// ── POST /api/auth/login ───────────────────────────────────────────────────
router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ ok: false, error: 'Email and password are required.' });
  }

  const emailLow = String(email).toLowerCase().trim();

  // Hardcoded admin login via env vars (no admin row in the users table needed)
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@2025';
  if (emailLow === ADMIN_EMAIL) {
    if (password !== adminPassword) {
      return res.status(401).json({ ok: false, error: 'Invalid email or password.' });
    }
    const adminUser = { id: 'admin', name: 'Administrator', email: ADMIN_EMAIL, role: 'admin' };
    const token = signToken(adminUser);
    return res.json({ ok: true, token, user: adminUser });
  }

  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(emailLow);
  if (!row || !verifyPassword(password, row.password_hash)) {
    return res.status(401).json({ ok: false, error: 'Invalid email or password.' });
  }

  const user = { id: row.id, name: row.name, email: row.email, role: row.role };
  const token = signToken(user);
  return res.json({ ok: true, token, user });
});

// ── GET /api/auth/me ────────────────────────────────────────────────────────
// Lets the frontend check/restore the session on page load.
router.get('/me', requireLogin, (req, res) => {
  res.json({ ok: true, user: req.user });
});

// ── POST /api/auth/forgot ──────────────────────────────────────────────────
// Generates a reset token. In production this would be emailed; here it's
// returned directly in the response, same behavior as the original localStorage version.
router.post('/forgot', (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ ok: false, error: 'Enter your email address.' });

  const emailLow = String(email).toLowerCase().trim();
  if (emailLow === ADMIN_EMAIL) {
    return res.status(400).json({ ok: false, error: 'Admin password cannot be reset here.' });
  }

  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(emailLow);
  if (!user) return res.status(404).json({ ok: false, error: 'No account found with this email.' });

  const token = crypto.randomBytes(4).toString('hex').toUpperCase(); // 8 chars
  const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

  db.prepare('DELETE FROM reset_tokens WHERE email = ?').run(emailLow); // clear old tokens
  db.prepare('INSERT INTO reset_tokens (token, email, expires_at) VALUES (?, ?, ?)')
    .run(token, emailLow, expiresAt);

  return res.json({ ok: true, token });
});

// ── POST /api/auth/reset ────────────────────────────────────────────────────
router.post('/reset', (req, res) => {
  const { token, newPassword } = req.body || {};
  if (!token || !newPassword) {
    return res.status(400).json({ ok: false, error: 'All fields are required.' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ ok: false, error: 'Password must be at least 8 characters.' });
  }

  const row = db.prepare('SELECT * FROM reset_tokens WHERE token = ?').get(token.toUpperCase());
  if (!row) return res.status(400).json({ ok: false, error: 'Invalid or expired reset code.' });

  if (Date.now() > row.expires_at) {
    db.prepare('DELETE FROM reset_tokens WHERE token = ?').run(row.token);
    return res.status(400).json({ ok: false, error: 'Reset code has expired. Please request a new one.' });
  }

  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(row.email);
  if (!user) return res.status(404).json({ ok: false, error: 'Account not found.' });

  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(newPassword), user.id);
  db.prepare('DELETE FROM reset_tokens WHERE token = ?').run(row.token);

  return res.json({ ok: true });
});

module.exports = router;
