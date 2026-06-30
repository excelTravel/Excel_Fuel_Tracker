/**
 * server.js — Excel Travel & Tours Fuel Management System API
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth.routes');
const entriesRoutes = require('./routes/entries.routes');
const fleetRoutes = require('./routes/fleet.routes');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ───────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: allowedOrigins.length ? allowedOrigins : true, // reflect request origin if not configured
  credentials: false,
}));
app.use(express.json());

// ── Routes ───────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ ok: true, status: 'healthy' }));

app.use('/api/auth', authRoutes);
app.use('/api/entries', entriesRoutes);
app.use('/api/fleet', fleetRoutes);

// ── 404 + error handling ──────────────────────────────────────────────────────
app.use('/api', (req, res) => res.status(404).json({ ok: false, error: 'Not found.' }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ ok: false, error: 'Internal server error.' });
});

app.listen(PORT, () => {
  console.log(`Excel Travel & Tours API listening on port ${PORT}`);
});
