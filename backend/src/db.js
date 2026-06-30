/**
 * db.js — SQLite database connection and schema setup.
 *
 * On Render, set DB_PATH to a path on a persistent disk, e.g. /data/fuel.db
 * (mount a Render Disk at /data so the SQLite file survives deploys/restarts).
 * Locally it defaults to ./data/fuel.db
 */

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'fuel.db');

// Make sure the directory exists
const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL CHECK (role IN ('agent','admin')) DEFAULT 'agent',
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS reset_tokens (
    token      TEXT PRIMARY KEY,
    email      TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS fuel_entries (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    agent_name      TEXT,
    agent_email     TEXT,
    station         TEXT NOT NULL CHECK (station IN ('merez','rubis')),
    bus_plate       TEXT NOT NULL,
    driver_name     TEXT,
    odometer        INTEGER,
    litres          REAL NOT NULL,
    price_per_litre REAL,
    cost            REAL,
    payment_status  TEXT NOT NULL CHECK (payment_status IN ('Paid','Pending','Credit')),
    entry_time      TEXT NOT NULL,
    notes           TEXT,
    submitted_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS fleet_buses (
    id          TEXT PRIMARY KEY,
    plate       TEXT NOT NULL UNIQUE,
    driver_name TEXT,
    model       TEXT,
    route       TEXT,
    added_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_fuel_entries_user_id    ON fuel_entries(user_id);
  CREATE INDEX IF NOT EXISTS idx_fuel_entries_entry_time ON fuel_entries(entry_time);
  CREATE INDEX IF NOT EXISTS idx_fuel_entries_bus_plate  ON fuel_entries(bus_plate);
`);

module.exports = db;
