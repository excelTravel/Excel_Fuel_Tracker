/**
 * routes/entries.routes.js — fuel log entries
 * Agents see/create only their own entries. Admin sees/manages all.
 */

const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { requireLogin, requireAdmin } = require('../middleware');

const router = express.Router();

function rowToEntry(row) {
  return {
    id: row.id,
    userId: row.user_id,
    agentName: row.agent_name,
    agentEmail: row.agent_email,
    station: row.station,
    busPlate: row.bus_plate,
    driverName: row.driver_name,
    odometer: row.odometer,
    litres: row.litres,
    pricePerLitre: row.price_per_litre,
    cost: row.cost,
    paymentStatus: row.payment_status,
    entryTime: row.entry_time,
    notes: row.notes,
    submittedAt: row.submitted_at,
  };
}

// ── GET /api/entries ────────────────────────────────────────────────────────
// Admin: all entries. Agent: only their own. Both newest first.
router.get('/', requireLogin, (req, res) => {
  let rows;
  if (req.user.role === 'admin') {
    rows = db.prepare('SELECT * FROM fuel_entries ORDER BY entry_time DESC, submitted_at DESC').all();
  } else {
    rows = db.prepare('SELECT * FROM fuel_entries WHERE user_id = ? ORDER BY entry_time DESC, submitted_at DESC')
      .all(req.user.id);
  }
  res.json({ ok: true, entries: rows.map(rowToEntry) });
});

// ── POST /api/entries ───────────────────────────────────────────────────────
// Any logged-in agent (or admin) can submit an entry, scoped to themselves.
router.post('/', requireLogin, (req, res) => {
  const { station, busPlate, driverName, odometer, litres, pricePerLitre, paymentStatus, entryTime, notes } = req.body || {};

  if (!station || !['merez', 'rubis'].includes(station)) {
    return res.status(400).json({ ok: false, error: 'A valid station is required.' });
  }
  if (!busPlate || !driverName) {
    return res.status(400).json({ ok: false, error: 'Plate number and driver name are required.' });
  }
  if (typeof litres !== 'number' || litres <= 0) {
    return res.status(400).json({ ok: false, error: 'Litres must be a positive number.' });
  }
  if (!['Paid', 'Pending', 'Credit'].includes(paymentStatus)) {
    return res.status(400).json({ ok: false, error: 'A valid payment status is required.' });
  }
  if (!entryTime) {
    return res.status(400).json({ ok: false, error: 'Entry date/time is required.' });
  }

  const cost = (typeof pricePerLitre === 'number') ? Math.round(litres * pricePerLitre) : null;

  const entry = {
    id: 'e_' + crypto.randomUUID(),
    user_id: req.user.id,
    agent_name: req.user.name,
    agent_email: req.user.email,
    station,
    bus_plate: String(busPlate).trim().toUpperCase(),
    driver_name: String(driverName).trim(),
    odometer: odometer != null ? parseInt(odometer, 10) : null,
    litres,
    price_per_litre: pricePerLitre ?? null,
    cost,
    payment_status: paymentStatus,
    entry_time: entryTime,
    notes: notes ? String(notes).trim() : null,
  };

  db.prepare(`
    INSERT INTO fuel_entries
      (id, user_id, agent_name, agent_email, station, bus_plate, driver_name,
       odometer, litres, price_per_litre, cost, payment_status, entry_time, notes)
    VALUES
      (@id, @user_id, @agent_name, @agent_email, @station, @bus_plate, @driver_name,
       @odometer, @litres, @price_per_litre, @cost, @payment_status, @entry_time, @notes)
  `).run(entry);

  const row = db.prepare('SELECT * FROM fuel_entries WHERE id = ?').get(entry.id);
  res.status(201).json({ ok: true, entry: rowToEntry(row) });
});

// ── DELETE /api/entries/:id ─────────────────────────────────────────────────
// Admin only — agents cannot delete entries (matches original frontend, where
// only the admin dashboard exposed a delete button).
router.delete('/:id', requireAdmin, (req, res) => {
  const result = db.prepare('DELETE FROM fuel_entries WHERE id = ?').run(req.params.id);
  if (result.changes === 0) {
    return res.status(404).json({ ok: false, error: 'Entry not found.' });
  }
  res.json({ ok: true });
});

module.exports = router;
