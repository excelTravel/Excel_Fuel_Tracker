const express = require('express');
const crypto = require('crypto');
const { readDb, writeDb } = require('../db');
const { authRequired, adminRequired } = require('../middleware/auth');

const router = express.Router();

// Every fleet route is admin-only (fleet.html calls Auth.requireAdmin()).
router.use(authRequired, adminRequired);

/** GET /api/fleet */
router.get('/', async (req, res, next) => {
  try {
    const db = await readDb();
    res.json({ ok: true, buses: db.fleet });
  } catch (err) {
    next(err);
  }
});

/** POST /api/fleet */
router.post('/', async (req, res, next) => {
  try {
    const { plate, driverName, model, route } = req.body || {};

    if (!plate || !String(plate).trim()) {
      return res.status(400).json({ ok: false, error: 'Plate number is required.' });
    }

    const db = await readDb();
    const normPlate = String(plate).trim().toUpperCase();

    if (db.fleet.some(b => b.plate === normPlate)) {
      return res.status(409).json({ ok: false, error: 'A bus with this plate number already exists.' });
    }

    const bus = {
      id: crypto.randomUUID(),
      plate: normPlate,
      driverName: driverName ? String(driverName).trim() : '',
      model: model ? String(model).trim() : '',
      route: route ? String(route).trim() : '',
      createdAt: new Date().toISOString(),
    };

    db.fleet.push(bus);
    await writeDb(db);

    res.status(201).json({ ok: true, bus });
  } catch (err) {
    next(err);
  }
});

/** DELETE /api/fleet/:id */
router.delete('/:id', async (req, res, next) => {
  try {
    const db = await readDb();
    const idx = db.fleet.findIndex(b => b.id === req.params.id);
    if (idx === -1) return res.status(404).json({ ok: false, error: 'Bus not found.' });

    db.fleet.splice(idx, 1);
    await writeDb(db);

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
