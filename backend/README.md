# Excel Travel & Tours — Fuel Management API

Backend for the Fuel Management System. Node.js + Express + SQLite (via
`better-sqlite3`), JWT auth, designed to deploy on Render with a persistent
disk for the database file.

## Local setup

```bash
npm install
cp .env.example .env
# edit .env — at minimum set JWT_SECRET to a long random string
npm start
```

Server runs on `http://localhost:3000` by default. The SQLite file is created
at `./data/fuel.db` (auto-created, gitignored).

## Deploying to Render

### Option A — render.yaml (recommended)

This repo includes a `render.yaml`. In the Render dashboard:

1. New → Blueprint, point it at this repo.
2. Render reads `render.yaml` and provisions:
   - A web service running `npm install` then `npm start`
   - A 1GB persistent disk mounted at `/data` (so the SQLite file survives
     deploys and restarts — without this, every deploy wipes the database)
3. You'll be prompted to fill in `ADMIN_PASSWORD` and `CORS_ORIGIN` (marked
   `sync: false`, i.e. not auto-generated). `JWT_SECRET` is generated for you.
4. Deploy.

### Option B — manual setup

1. New → Web Service, connect this repo.
2. Build command: `npm install`
3. Start command: `npm start`
4. Add a Disk: mount path `/data`, size 1GB (Render dashboard → your service →
   Disks). **This step is required** — without a persistent disk, the SQLite
   file lives on ephemeral storage and gets wiped on every deploy/restart.
5. Environment variables (Render dashboard → Environment):
   - `JWT_SECRET` — long random string (required)
   - `JWT_EXPIRES_IN` — e.g. `7d` (optional, defaults to 7d)
   - `ADMIN_EMAIL` — e.g. `admin@exceltravel.rw` (optional, has a default)
   - `ADMIN_PASSWORD` — your admin login password (required — don't keep the
     default in production)
   - `DB_PATH` — `/data/fuel.db` (must match your disk's mount path)
   - `CORS_ORIGIN` — your frontend's URL, e.g.
     `https://your-frontend.onrender.com` (comma-separate multiple origins;
     leave blank to allow all origins, fine for testing, not for production)

Render's free-tier disks persist across deploys but the free **web service**
tier spins down when idle and cold-starts on the next request — the first
request after idle may take a few seconds.

## Authentication

- Admin is a hardcoded account from `ADMIN_EMAIL` / `ADMIN_PASSWORD` env vars
  (no database row) — matches the original frontend's behavior.
- Agents register/login normally; passwords are hashed with bcrypt.
- Successful login returns a JWT. Send it on every subsequent request as:
  `Authorization: Bearer <token>`
- Tokens expire after `JWT_EXPIRES_IN` (default 7 days); there's no refresh
  endpoint, so the frontend should redirect to login on a 401.

## API reference

All responses are JSON. Error responses look like `{ "ok": false, "error": "..." }`.
Successful responses include `"ok": true` plus the relevant data.

### Auth — `/api/auth`

| Method | Path | Auth | Body | Description |
|---|---|---|---|---|
| POST | `/register` | none | `{ name, email, password }` | Create an agent account |
| POST | `/login` | none | `{ email, password }` | Returns `{ token, user }` |
| GET | `/me` | Bearer | — | Returns the current user from the token |
| POST | `/forgot` | none | `{ email }` | Returns `{ token }` (simulates emailing a reset code) |
| POST | `/reset` | none | `{ token, newPassword }` | Resets password using the code from `/forgot` |

### Fuel entries — `/api/entries`

| Method | Path | Auth | Body | Description |
|---|---|---|---|---|
| GET | `/` | Bearer | — | Admin: all entries. Agent: only their own. Newest first. |
| POST | `/` | Bearer | see below | Create an entry, scoped to the logged-in user |
| DELETE | `/:id` | Admin | — | Delete an entry |

POST body:
```json
{
  "station": "merez",          // "merez" or "rubis"
  "busPlate": "RAB 123A",
  "driverName": "Eric K",
  "odometer": 123456,           // optional
  "litres": 45.5,
  "pricePerLitre": 1700,        // optional
  "paymentStatus": "Paid",      // "Paid" | "Pending" | "Credit"
  "entryTime": "2026-06-28T10:00",
  "notes": "optional notes"
}
```

### Fleet — `/api/fleet` (admin only)

| Method | Path | Auth | Body | Description |
|---|---|---|---|---|
| GET | `/` | Admin | — | List all buses in the fleet |
| POST | `/` | Admin | `{ plate, driverName?, model?, route? }` | Add a bus |
| DELETE | `/:id` | Admin | — | Remove a bus |

### Health check

`GET /api/health` → `{ "ok": true, "status": "healthy" }` (no auth)

## Notes on data model

- `fuel_entries.user_id` references `users.id`, except the admin user (which
  has no row in `users` — admin-created entries would use `"admin"` as the id).
- Cost is computed server-side as `litres * pricePerLitre` when both are present.
- Plates are normalized to uppercase, trimmed, both for entries and fleet buses,
  so fleet/entry cross-referencing by plate works reliably.
