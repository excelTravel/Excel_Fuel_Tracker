require('dotenv').config();

const express = require('express');
const cors = require('cors');

const { initDb, seedAdmin } = require('./src/db');
const authRoutes = require('./src/routes/auth.routes');
const entriesRoutes = require('./src/routes/entries.routes');
const fleetRoutes = require('./src/routes/fleet.routes');

if (!process.env.JWT_SECRET) {
  console.warn(
    '\n⚠️  No JWT_SECRET set (copy .env.example to .env and set one).\n' +
    '    Using an insecure fallback for now — do NOT do this in production.\n'
  );
  process.env.JWT_SECRET = 'insecure-dev-only-secret-change-me';
}

const app = express();
const PORT = process.env.PORT || 5000;

const corsOrigin = process.env.CORS_ORIGIN && process.env.CORS_ORIGIN !== '*'
  ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
  : '*';
app.use(cors({ origin: corsOrigin }));
app.use(express.json());

initDb();
seedAdmin();

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'excel-travel-fuel-backend', time: new Date().toISOString() });
});

app.use('/auth', authRoutes);
app.use('/api/entries', entriesRoutes);
app.use('/api/fleet', fleetRoutes);

// 404 fallback
app.use((req, res) => {
  res.status(404).json({ ok: false, error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ ok: false, error: 'Internal server error.' });
});

app.listen(PORT, () => {
  console.log(`Excel Travel & Tours fuel backend running at http://127.0.0.1:${PORT}/api`);
});
