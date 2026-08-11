const express = require('express');
const crypto = require('crypto');
const { readDb, writeDb } = require('../db');
const { authRequired, adminRequired } = require('../middleware/auth');

const router = express.Router();

router.use(authRequired);

/** GET /api/entries — admin sees everything, agents see only their own station's entries. */
router.get('/', async (req, res, next) => {
  try {
    const db = await readDb();
    const entries = req.user.role === 'admin'
      ? db.entries
      : db.entries.filter(e => e.station === req.user.station);

    entries.sort((a, b) => new Date(b.entryTime) - new Date(a.entryTime));
    res.json({ ok: true, entries });
  } catch (err) {
    next(err);
  }
});

/** POST /api/entries — userId/agentName/agentEmail/cost are always server-derived. */
router.post('/', async (req, res, next) => {
  try {
    const b = req.body || {};
    const litres = parseFloat(b.litres);
    const pricePerLitre = parseFloat(b.pricePerLitre);

    // Agents can only ever submit to their own assigned station — the client's
    // `station` value is ignored for them and replaced with the one on file,
    // so a Merez agent can't post (or spoof) a Rubis entry and vice versa.
    const station = req.user.role === 'admin' ? b.station : req.user.station;

    if (!b.busPlate || !b.driverName || !station || !b.paymentStatus || !b.entryTime) {
      return res.status(400).json({ ok: false, error: 'Missing required fields.' });
    }
    if (!Number.isFinite(litres) || litres <= 0) {
      return res.status(400).json({ ok: false, error: 'Litres must be a positive number.' });
    }
    if (!Number.isFinite(pricePerLitre) || pricePerLitre < 0) {
      return res.status(400).json({ ok: false, error: 'Price per litre must be a valid number.' });
    }
    if (!['merez', 'rubis'].includes(station)) {
      return res.status(400).json({ ok: false, error: 'Invalid station.' });
    }
    if (!['Paid', 'Pending', 'Credit'].includes(b.paymentStatus)) {
      return res.status(400).json({ ok: false, error: 'Invalid payment status.' });
    }

    const db = await readDb();

    // Same bus, same station, same calendar day (entryTime is a
    // datetime-local value like "2026-08-11T10:06" — the first 10 chars
    // are the date). If one already exists, the agent must give a reason
    // for the second fuel-up before it's accepted.
    const entryDate = String(b.entryTime).slice(0, 10);
    const isDuplicate = db.entries.some(existing =>
      existing.station === station &&
      existing.busPlate === String(b.busPlate).trim().toUpperCase() &&
      String(existing.entryTime).slice(0, 10) === entryDate
    );
    const reason = b.reason ? String(b.reason).trim() : '';

    if (isDuplicate && !reason) {
      return res.status(409).json({
        ok: false,
        duplicate: true,
        error: 'This bus already has an entry today. Please give a reason for the additional fuel-up.',
      });
    }

    const entry = {
      id: crypto.randomUUID(),
      userId: req.user.id,
      agentName: req.user.name,
      agentEmail: req.user.email,
      station,
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
      reason: isDuplicate ? reason : null,
      createdAt: new Date().toISOString(),
    };

    db.entries.push(entry);
    await writeDb(db);

    res.status(201).json({ ok: true, entry });
  } catch (err) {
    next(err);
  }
});

/** DELETE /api/entries/:id — admin only (matches admin-dashboard.js usage). */
router.delete('/:id', adminRequired, async (req, res, next) => {
  try {
    const db = await readDb();
    const idx = db.entries.findIndex(e => e.id === req.params.id);
    if (idx === -1) return res.status(404).json({ ok: false, error: 'Entry not found.' });

    db.entries.splice(idx, 1);
    await writeDb(db);

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
