const express = require('express');
const crypto = require('crypto');
const { readDb, writeDb } = require('../db');
const { authRequired, adminRequired } = require('../middleware/auth');

const router = express.Router();

router.use(authRequired);

/** GET /api/entries — admin sees everything, agents see only their own. */
router.get('/', (req, res) => {
  const db = readDb();
  const entries = req.user.role === 'admin'
    ? db.entries
    : db.entries.filter(e => e.userId === req.user.id);

  entries.sort((a, b) => new Date(b.entryTime) - new Date(a.entryTime));
  res.json({ ok: true, entries });
});

/** POST /api/entries — userId/agentName/agentEmail/cost are always server-derived. */
router.post('/', (req, res) => {
  const b = req.body || {};
  const litres = parseFloat(b.litres);
  const pricePerLitre = parseFloat(b.pricePerLitre);

  if (!b.busPlate || !b.driverName || !b.station || !b.paymentStatus || !b.entryTime) {
    return res.status(400).json({ ok: false, error: 'Missing required fields.' });
  }
  if (!Number.isFinite(litres) || litres <= 0) {
    return res.status(400).json({ ok: false, error: 'Litres must be a positive number.' });
  }
  if (!Number.isFinite(pricePerLitre) || pricePerLitre < 0) {
    return res.status(400).json({ ok: false, error: 'Price per litre must be a valid number.' });
  }
  if (!['merez', 'rubis'].includes(b.station)) {
    return res.status(400).json({ ok: false, error: 'Invalid station.' });
  }
  if (!['Paid', 'Pending', 'Credit'].includes(b.paymentStatus)) {
    return res.status(400).json({ ok: false, error: 'Invalid payment status.' });
  }

  const db = readDb();
  const entry = {
    id: crypto.randomUUID(),
    userId: req.user.id,
    agentName: req.user.name,
    agentEmail: req.user.email,
    station: b.station,
    busPlate: String(b.busPlate).trim().toUpperCase(),
    driverName: String(b.driverName).trim(),
    odometer: b.odometer !== undefined && b.odometer !== null && b.odometer !== ''
      ? parseInt(b.odometer, 10) : null,
    litres,
    pricePerLitre,
    cost: Math.round(litres * pricePerLitre),
    paymentStatus: b.paymentStatus,
    entryTime: b.entryTime,
    notes: b.notes ? String(b.notes).trim() : '',
    createdAt: new Date().toISOString(),
  };

  db.entries.push(entry);
  writeDb(db);

  res.status(201).json({ ok: true, entry });
});

/** DELETE /api/entries/:id — admin only (matches admin-dashboard.js usage). */
router.delete('/:id', adminRequired, (req, res) => {
  const db = readDb();
  const idx = db.entries.findIndex(e => e.id === req.params.id);
  if (idx === -1) return res.status(404).json({ ok: false, error: 'Entry not found.' });

  db.entries.splice(idx, 1);
  writeDb(db);

  res.json({ ok: true });
});

module.exports = router;
