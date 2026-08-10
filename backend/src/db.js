/**
 * db.js — Postgres-backed storage for the fuel tracker backend.
 *
 * Connects using DATABASE_URL (set this to your Render Postgres — or local
 * Postgres — connection string). readDb()/writeDb() keep the same shape the
 * routes already use ({ users, entries, fleet }), but are now async since
 * every Postgres call goes over the network — every caller must `await` them.
 *
 * writeDb() replaces the full contents of all three tables in one
 * transaction, same "full replace" approach the old SQLite version used.
 * This keeps route code nearly unchanged, but it's not how you'd want a
 * high-traffic multi-user app to work long term — a future step would be to
 * replace this with targeted INSERT/UPDATE/DELETE calls per route instead of
 * a full-table replace on every write.
 */
require('dotenv').config();

const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.warn(
    '\n  No DATABASE_URL set (copy .env.example to .env and set one).\n' +
    '    The app cannot connect to a database without it.\n'
  );
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Render's managed Postgres requires SSL; local Postgres on your machine
  // does not use/support it, so only enable this for non-local connections.
  ssl: process.env.DATABASE_URL && !/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL)
    ? { rejectUnauthorized: false }
    : false,
});

function emptyDb() {
  return { users: [], entries: [], fleet: [] };
}

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      "passwordHash" TEXT NOT NULL,
      role TEXT NOT NULL,
      station TEXT,
      "resetToken" TEXT,
      "resetTokenExpires" BIGINT,
      "createdAt" TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS entries (
      id TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "agentName" TEXT NOT NULL,
      "agentEmail" TEXT NOT NULL,
      station TEXT NOT NULL,
      "busPlate" TEXT NOT NULL,
      "driverName" TEXT NOT NULL,
      odometer INTEGER,
      litres REAL NOT NULL,
      "pricePerLitre" REAL NOT NULL,
      cost INTEGER NOT NULL,
      "paymentStatus" TEXT NOT NULL,
      "entryTime" TEXT NOT NULL,
      notes TEXT NOT NULL,
      "createdAt" TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS fleet (
      id TEXT PRIMARY KEY,
      plate TEXT NOT NULL UNIQUE,
      "driverName" TEXT NOT NULL,
      model TEXT NOT NULL,
      route TEXT NOT NULL,
      "createdAt" TEXT NOT NULL
    );
  `);
}

async function readDb() {
  const [users, entries, fleet] = await Promise.all([
    pool.query('SELECT * FROM users ORDER BY "createdAt" ASC'),
    pool.query('SELECT * FROM entries ORDER BY "createdAt" ASC'),
    pool.query('SELECT * FROM fleet ORDER BY "createdAt" ASC'),
  ]);
  return { users: users.rows, entries: entries.rows, fleet: fleet.rows };
}

async function writeDb(data) {
  const payload = data || emptyDb();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM users');
    await client.query('DELETE FROM entries');
    await client.query('DELETE FROM fleet');

    for (const u of payload.users || []) {
      await client.query(
        `INSERT INTO users (id, name, email, "passwordHash", role, station, "resetToken", "resetTokenExpires", "createdAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [u.id, u.name, u.email, u.passwordHash, u.role, u.station || null, u.resetToken || null, u.resetTokenExpires || null, u.createdAt]
      );
    }

    for (const e of payload.entries || []) {
      await client.query(
        `INSERT INTO entries (id, "userId", "agentName", "agentEmail", station, "busPlate", "driverName", odometer,
                               litres, "pricePerLitre", cost, "paymentStatus", "entryTime", notes, "createdAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [e.id, e.userId, e.agentName, e.agentEmail, e.station, e.busPlate, e.driverName, e.odometer ?? null,
         e.litres, e.pricePerLitre, e.cost, e.paymentStatus, e.entryTime, e.notes || '', e.createdAt]
      );
    }

    for (const b of payload.fleet || []) {
      await client.query(
        `INSERT INTO fleet (id, plate, "driverName", model, route, "createdAt")
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [b.id, b.plate, b.driverName, b.model, b.route, b.createdAt]
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/** Creates the default admin account on first run, if it doesn't exist yet. */
async function seedAdmin() {
  const db = await readDb();
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@exceltravel.rw').trim().toLowerCase();
  const exists = db.users.find(u => u.email.toLowerCase() === adminEmail);
  if (exists) return;

  const bcrypt = require('bcryptjs');
  const crypto = require('crypto');
  const passwordHash = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'ChangeMe123!', 10);

  db.users.push({
    id: crypto.randomUUID(),
    name: process.env.ADMIN_NAME || 'HQ Admin',
    email: adminEmail,
    passwordHash,
    role: 'admin',
    station: null,
    resetToken: null,
    resetTokenExpires: null,
    createdAt: new Date().toISOString(),
  });
  await writeDb(db);
  console.log(`Seeded default admin account: ${adminEmail}`);
}

/** Call once when a script (not the long-running server) is done, so the process can exit. */
async function closePool() {
  await pool.end();
}

module.exports = { initDb, readDb, writeDb, seedAdmin, closePool };
