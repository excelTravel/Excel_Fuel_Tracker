/**
 * update-email.js — changes an existing user's email address directly in
 * the database. Useful for correcting the seeded admin's email, since
 * there's no "edit account" route in the app yet.
 *
 * Usage (from the backend/ folder):
 *   node scripts/update-email.js "old@example.com" "new@example.com"
 *
 * On Render: run the same command in the service's Shell tab.
 */
const { initDb, readDb, writeDb } = require('../src/db');

const [, , oldEmail, newEmail] = process.argv;

if (!oldEmail || !newEmail) {
  console.error('Usage: node scripts/update-email.js "old@example.com" "new@example.com"');
  process.exit(1);
}

initDb();

const normOld = oldEmail.trim().toLowerCase();
const normNew = newEmail.trim().toLowerCase();
const db = readDb();

const user = db.users.find(u => u.email.toLowerCase() === normOld);
if (!user) {
  console.error(`No account found with email "${normOld}".`);
  process.exit(1);
}

if (db.users.some(u => u.email.toLowerCase() === normNew && u.id !== user.id)) {
  console.error(`An account with email "${normNew}" already exists.`);
  process.exit(1);
}

user.email = normNew;
writeDb(db);

console.log(`Updated ${user.role} account: ${normOld} -> ${normNew}`);