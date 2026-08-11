# Excel Travel & Tours — Fuel Tracker

A fuel management system for Excel Travel & Tours' bus fleet, covering two
stations (Merez and Rubis). Agents log fuel intake per bus at their station;
HQ admins get a live dashboard across both stations plus fleet management.

## Features

- **Agent fuel entry** — station-scoped form with a plate-number dropdown
  (pre-filled from the known fleet per station, but agents can still type any
  plate not on the list), driver, litres, price, payment status, and notes.
- **Admin dashboard** — station breakdown, KPIs, per-agent summaries, and a
  filterable/exportable log of every entry.
- **Fleet management** — add/remove buses, see which ones have and haven't
  been fuelled.
- **Auth** — JWT-based login/registration, agent vs. admin roles, agents are
  permanently scoped to the station they registered under.
- **Responsive UI** — usable on desktop, tablet, and phone.

## Tech stack

| Layer    | Tech |
|----------|------|
| Frontend | Vanilla HTML / CSS / JS (no build step) |
| Backend  | Node.js + Express |
| Storage  | Postgres via the `pg` client |
| Auth     | JWT (`jsonwebtoken`) + `bcryptjs` for password hashing |

## Project structure

```
Excel-Fuel-Tracker/
├── backend/
│   ├── server.js            # Express app entrypoint
│   ├── src/
│   │   ├── db.js            # Postgres setup + seed admin
│   │   ├── middleware/auth.js
│   │   └── routes/          # auth, entries, fleet
│   ├── scripts/              # create-admin, update-email, update-password
│   ├── .env.example         # copy to .env and fill in
│   └── package.json
└── frontend/
    ├── index.html           # agent fuel entry form
    ├── login.html / register.html
    ├── pages/
    │   ├── dashboard.html       # agent's own entry log
    │   ├── admin-dashboard.html # HQ dashboard
    │   └── fleet.html           # fleet management
    ├── js/                  # config, auth, store, per-page logic
    └── css/style.css
```

## Local setup

### Backend

Requires a running Postgres instance (local install, or a Render/other
managed Postgres) and Node ≥ 18.

```bash
cd backend
npm install
cp .env.example .env
```

Open `.env` and set:
- `DATABASE_URL` — your Postgres connection string, e.g.
  `postgresql://postgres:yourpassword@localhost:5432/fuel_tracker` for a
  local database (create it first with `createdb fuel_tracker` or via
  pgAdmin), or the connection string from your Render Postgres instance.
- `JWT_SECRET` — generate one with:
  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  ```
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` — the seed admin account, created
  automatically on first run if no user with that email exists yet.

Tables are created automatically on startup if they don't already exist —
no separate migration step needed.

Run it:

```bash
npm start        # production
npm run dev      # auto-restarts on file changes
```

You should see:

```
Seeded default admin account: <your ADMIN_EMAIL>
Excel Travel & Tours fuel backend running at http://127.0.0.1:5000/api
```

### Frontend

No build step — just open `frontend/index.html` (or `login.html`) in a
browser, or serve the folder with any static server. It talks to the backend
at `http://127.0.0.1:5000/api` by default (see `js/config.js`).

- **Admin:** log in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env`.
- **Agents:** register via `register.html` — accounts are always created
  with role `agent`, tied to the station chosen at signup.

## Environment variables (backend)

| Variable          | Description                                              |
|-------------------|------------------------------------------------------------|
| `PORT`            | Port the server listens on (default `5000`)                |
| `DATABASE_URL`     | Postgres connection string — required                       |
| `JWT_SECRET`       | Long random string used to sign auth tokens — required     |
| `JWT_EXPIRES_IN`   | Token lifetime (default `7d`)                              |
| `ADMIN_NAME`       | Display name for the seeded admin account                  |
| `ADMIN_EMAIL`      | Seed admin's login email                                    |
| `ADMIN_PASSWORD`   | Seed admin's login password — change this before deploying |
| `CORS_ORIGIN`      | Allowed frontend origin(s), comma-separated. Use `*` only for local dev — set to the real frontend URL in production |

## API reference

All routes are prefixed with `/api`. Authenticated routes expect
`Authorization: Bearer <token>`.

| Method | Path             | Auth   | Description                                       |
|--------|------------------|--------|---------------------------------------------------|
| GET    | `/health`        | none   | Health check                                       |
| POST   | `/auth/register` | none   | Create an agent account                            |
| POST   | `/auth/login`    | none   | Returns `{ token, user }`                          |
| GET    | `/auth/me`       | any    | Validates the current token                        |
| POST   | `/auth/forgot`   | none   | Generates a password reset code                    |
| POST   | `/auth/reset`    | none   | Resets password with the code                      |
| GET    | `/entries`       | any    | Admin: all entries. Agent: own station only        |
| POST   | `/entries`       | any    | Create a fuel entry                                |
| DELETE | `/entries/:id`   | admin  | Delete an entry                                    |
| GET    | `/fleet`         | admin  | List all buses                                     |
| POST   | `/fleet`         | admin  | Add a bus                                          |
| DELETE | `/fleet/:id`     | admin  | Remove a bus                                       |

## Account management scripts

There's no UI for editing accounts yet (and no public "register as admin"
route, on purpose). These run directly against the database — from
`backend/`, with `DATABASE_URL` pointed at whichever database you mean to
change:

```bash
node scripts/create-admin.js "Full Name" "email@example.com" "StrongPassword123"
node scripts/update-email.js "old@example.com" "new@example.com"
node scripts/update-password.js "email@example.com" "NewStrongPassword123"
```

## Deployment

Deploy three separate services on Render: Postgres, backend, frontend.

1. **Postgres** — Render dashboard → **+ New** → **Postgres**. Once created,
   copy its **Internal Database URL** (for the backend to use) — internal
   is faster and free, since both services live on Render's network.
2. **Backend** (Web Service) — set all environment variables above,
   including `DATABASE_URL` from step 1. Build command `npm install`, start
   command `npm start`. No persistent disk needed anymore — Postgres is a
   separate service, so your data survives backend redeploys/restarts
   regardless of instance type.
3. **Frontend** (Static Site) — before deploying, point it at the live
   backend by adding this above the `config.js` script tag on every HTML
   page:
   ```html
   <script>window.API_BASE_URL = 'https://<your-backend-url>/api';</script>
   <script src="js/config.js"></script>
   ```
4. Once both the backend and frontend are live, set the backend's
   `CORS_ORIGIN` to the frontend's real URL (not `*`).

To run one of the account-management scripts against the live Render
database from your own machine, set `DATABASE_URL` in your local `.env` to
the Postgres instance's **External Database URL** (found on its Info page)
instead of a local one, then run the script normally.

## Known limitations / next steps

- Password reset codes are currently returned directly in the API response
  rather than emailed/texted — fine for internal use, not for a public
  rollout.
- `writeDb()` replaces the full contents of all three tables on every write
  rather than doing targeted inserts/updates — fine for a small team's
  traffic, but worth revisiting (per-route queries instead) if usage grows.
- No automated tests yet.
