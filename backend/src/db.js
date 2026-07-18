/**
 * db.js — SQLite-backed storage for the fuel tracker backend.
 *
 * The application still exposes the same readDb()/writeDb() contract to the
 * routes, but data is now persisted in a SQLite database file rather than a
 * JSON document.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { DatabaseSync } = require('node:sqlite');

const DB_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DB_DIR, 'fuel-tracker.db');
const LEGACY_DB_PATH = path.join(DB_DIR, 'db.json');
let dbConnection;

function emptyDb() {
  return { users: [], entries: [], fleet: [] };
}

function ensureDbDir() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
}

function getDb() {
  if (!dbConnection) {
    ensureDbDir();
    dbConnection = new DatabaseSync(DB_PATH);
    dbConnection.exec('PRAGMA foreign_keys = ON;');
  }
  return dbConnection;
}

function importLegacyJsonIfNeeded() {
  if (!fs.existsSync(LEGACY_DB_PATH)) return;

  const connection = getDb();
  const hasRows = ['users', 'entries', 'fleet'].some((tableName) => {
    const result = connection.prepare(`SELECT COUNT(*) AS count FROM ${tableName}`).get();
    return result.count > 0;
  });

  if (hasRows) return;

  try {
    const raw = fs.readFileSync(LEGACY_DB_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    writeDb(parsed);
  } catch {
    // Ignore legacy import errors and continue with empty tables.
  }
}

function initDb() {
  const connection = getDb();
  connection.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      passwordHash TEXT NOT NULL,
      role TEXT NOT NULL,
      station TEXT,
      resetToken TEXT,
      resetTokenExpires INTEGER,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS entries (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      agentName TEXT NOT NULL,
      agentEmail TEXT NOT NULL,
      station TEXT NOT NULL,
      busPlate TEXT NOT NULL,
      driverName TEXT NOT NULL,
      odometer INTEGER,
      litres REAL NOT NULL,
      pricePerLitre REAL NOT NULL,
      cost INTEGER NOT NULL,
      paymentStatus TEXT NOT NULL,
      entryTime TEXT NOT NULL,
      notes TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS fleet (
      id TEXT PRIMARY KEY,
      plate TEXT NOT NULL UNIQUE,
      driverName TEXT NOT NULL,
      model TEXT NOT NULL,
      route TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
  `);

  importLegacyJsonIfNeeded();
}

function readDb() {
  const connection = getDb();
  const users = connection.prepare('SELECT * FROM users ORDER BY createdAt ASC').all();
  const entries = connection.prepare('SELECT * FROM entries ORDER BY createdAt ASC').all();
  const fleet = connection.prepare('SELECT * FROM fleet ORDER BY createdAt ASC').all();
  return { users, entries, fleet };
}

function writeDb(data) {
  const connection = getDb();
  const payload = data || emptyDb();

  connection.exec('BEGIN');
  try {
    connection.prepare('DELETE FROM users').run();
    connection.prepare('DELETE FROM entries').run();
    connection.prepare('DELETE FROM fleet').run();

    const insertUser = connection.prepare(`
      INSERT INTO users (id, name, email, passwordHash, role, station, resetToken, resetTokenExpires, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const user of payload.users || []) {
      insertUser.run(
        user.id,
        user.name,
        user.email,
        user.passwordHash,
        user.role,
        user.station || null,
        user.resetToken || null,
        user.resetTokenExpires || null,
        user.createdAt
      );
    }

    const insertEntry = connection.prepare(`
      INSERT INTO entries (
        id, userId, agentName, agentEmail, station, busPlate, driverName, odometer,
        litres, pricePerLitre, cost, paymentStatus, entryTime, notes, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const entry of payload.entries || []) {
      insertEntry.run(
        entry.id,
        entry.userId,
        entry.agentName,
        entry.agentEmail,
        entry.station,
        entry.busPlate,
        entry.driverName,
        entry.odometer ?? null,
        entry.litres,
        entry.pricePerLitre,
        entry.cost,
        entry.paymentStatus,
        entry.entryTime,
        entry.notes || '',
        entry.createdAt
      );
    }

    const insertBus = connection.prepare(`
      INSERT INTO fleet (id, plate, driverName, model, route, createdAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const bus of payload.fleet || []) {
      insertBus.run(bus.id, bus.plate, bus.driverName, bus.model, bus.route, bus.createdAt);
    }

    connection.exec('COMMIT');
  } catch (error) {
    connection.exec('ROLLBACK');
    throw error;
  }
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
