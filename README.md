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
| Storage  | SQLite via the built-in `node:sqlite` module |
| Auth     | JWT (`jsonwebtoken`) + `bcryptjs` for password hashing |

## Project structure

```
Excel-Fuel-Tracker/
├── backend/
│   ├── server.js            # Express app entrypoint
│   ├── src/
│   │   ├── db.js            # SQLite setup + seed admin
│   │   ├── middleware/auth.js
│   │   └── routes/          # auth, entries, fleet
│   ├── data/                # SQLite file lives here (gitignored)
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

Requires **Node ≥ 22.13** (the built-in `node:sqlite` module needs it).

```bash
cd backend
npm install
cp .env.example .env
```

Open `.env` and set:
- `JWT_SECRET` — generate one with:
  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  ```
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` — the seed admin account, created
  automatically on first run if no user with that email exists yet.

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

## Deployment

Deploy backend and frontend as two separate services (e.g. Render Web
Service + Static Site):

1. **Backend** — set all environment variables above, use `npm install` as
   the build command and `npm start` to run. Attach a **persistent disk**
   mounted at the backend's `data/` directory, or the SQLite file resets on
   every redeploy.
2. **Frontend** — deploy as a static site. Before deploying, point it at the
   live backend by adding this above the `config.js` script tag on every
   HTML page:
   ```html
   <script>window.API_BASE_URL = 'https://<your-backend-url>/api';</script>
   <script src="js/config.js"></script>
   ```
3. Once both are live, set the backend's `CORS_ORIGIN` to the frontend's
   real URL (not `*`).

## Known limitations / next steps

- Password reset codes are currently returned directly in the API response
  rather than emailed/texted — fine for internal use, not for a public
  rollout.
- SQLite has no real concurrency control. Fine for a small team; move to
  Postgres if traffic grows.
- No automated tests yet.
