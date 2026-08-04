/**
 * create-admin.js — adds an additional admin account directly to the
 * database. There's no public "register as admin" route on purpose (letting
 * anyone self-register as admin would be a security hole), so new admins
 * are added this way instead — run manually by someone who already has
 * server/database access.
 *
 * Usage (from the backend/ folder):
 *   node scripts/create-admin.js "Full Name" "email@example.com" "StrongPassword123"
 *
 * On Render: open the service's Shell tab and run the same command there,
 * so it runs against the same database the live app uses.
 */
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { initDb, readDb, writeDb } = require('../src/db');

const [, , name, email, password] = process.argv;

if (!name || !email || !password) {
  console.error('Usage: node scripts/create-admin.js "Full Name" "email@example.com" "StrongPassword123"');
  process.exit(1);
}
if (password.length < 8) {
  console.error('Password must be at least 8 characters.');
  process.exit(1);
}

initDb();

const normEmail = email.trim().toLowerCase();
const db = readDb();

if (db.users.some(u => u.email.toLowerCase() === normEmail)) {
  console.error(`An account with email "${normEmail}" already exists.`);
  process.exit(1);
}

db.users.push({
  id: crypto.randomUUID(),
  name: name.trim(),
  email: normEmail,
  passwordHash: bcrypt.hashSync(password, 10),
  role: 'admin',
  station: null,
  resetToken: null,
  resetTokenExpires: null,
  createdAt: new Date().toISOString(),
});

writeDb(db);

console.log(`Admin account created: ${normEmail}`);