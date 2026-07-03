/**
 * db.js — tiny JSON-file "database".
 *
 * This is intentionally dependency-free (no native modules, no external DB
 * server) so the project runs anywhere Node.js runs. Everything is read
 * from / written to data/db.json as a single JSON document.
 *
 * Swap this module out for a real database (Postgres, MySQL, Mongo, etc.)
 * later without touching the routes — they only ever call readDb()/writeDb().
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, '..', 'data', 'db.json');

function emptyDb() {
  return { users: [], entries: [], fleet: [] };
}

function initDb() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    writeDb(emptyDb());
  }
}

function readDb() {
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    const data = JSON.parse(raw);
    return {
      users: data.users || [],
      entries: data.entries || [],
      fleet: data.fleet || [],
    };
  } catch {
    return emptyDb();
  }
}

function writeDb(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

/** Creates the default admin account on first run, if it doesn't exist yet. */
function seedAdmin() {
  const db = readDb();
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@exceltravel.rw').trim().toLowerCase();
  const exists = db.users.find(u => u.email.toLowerCase() === adminEmail);
  if (exists) return;

  const passwordHash = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'ChangeMe123!', 10);
  db.users.push({
    id: crypto.randomUUID(),
    name: process.env.ADMIN_NAME || 'HQ Admin',
    email: adminEmail,
    passwordHash,
    role: 'admin',
    resetToken: null,
    resetTokenExpires: null,
    createdAt: new Date().toISOString(),
  });
  writeDb(db);
  console.log(`Seeded default admin account: ${adminEmail}`);
}

module.exports = { initDb, readDb, writeDb, seedAdmin, DB_PATH };
