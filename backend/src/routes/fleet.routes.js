/**
 * routes/fleet.routes.js — master list of company buses (admin only)
 */

const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { requireAdmin } = require('../middleware');

const router = express.Router();

function rowToBus(row) {
  return {
    id: row.id,
    plate: row.plate,
    driverName: row.driver_name,
    model: row.model,
    route: row.route,
    addedAt: row.added_at,
  };
}

// ── GET /api/fleet ──────────────────────────────────────────────────────────
router.get('/', requireAdmin, (req, res) => {
  const rows = db.prepare('SELECT * FROM fleet_buses ORDER BY added_at DESC').all();
  res.json({ ok: true, buses: rows.map(rowToBus) });
});

// ── POST /api/fleet ─────────────────────────────────────────────────────────
router.post('/', requireAdmin, (req, res) => {
  const { plate, driverName, model, route } = req.body || {};
  const plateClean = (plate || '').trim().toUpperCase();

  if (!plateClean) {
    return res.status(400).json({ ok: false, error: 'Plate number is required.' });
  }

  const existing = db.prepare('SELECT id FROM fleet_buses WHERE plate = ?').get(plateClean);
  if (existing) {
    return res.status(409).json({ ok: false, error: 'A bus with this plate is already in the fleet.' });
  }

  const bus = {
    id: 'bus_' + crypto.randomUUID(),
    plate: plateClean,
    driver_name: (driverName || '').trim() || null,
    model: (model || '').trim() || null,
    route: (route || '').trim() || null,
  };

  db.prepare(`
    INSERT INTO fleet_buses (id, plate, driver_name, model, route)
    VALUES (@id, @plate, @driver_name, @model, @route)
  `).run(bus);

  const row = db.prepare('SELECT * FROM fleet_buses WHERE id = ?').get(bus.id);
  res.status(201).json({ ok: true, bus: rowToBus(row) });
});

// ── DELETE /api/fleet/:id ────────────────────────────────────────────────────
router.delete('/:id', requireAdmin, (req, res) => {
  const result = db.prepare('DELETE FROM fleet_buses WHERE id = ?').run(req.params.id);
  if (result.changes === 0) {
    return res.status(404).json({ ok: false, error: 'Bus not found.' });
  }
  res.json({ ok: true });
});

module.exports = router;
