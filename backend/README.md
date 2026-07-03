# Excel Travel & Tours — Fuel Tracker Backend

Node.js/Express API that powers the existing frontend (`login.html`,
`register.html`, `index.html`, `dashboard.html`, `fleet.html`,
`admin-dashboard.html` + their `.js` files). No frontend code needs to
change — `Auth` and `Store`/`Fleet` in the frontend already call these exact
routes.

Data is stored in a single JSON file (`data/db.json`), created and seeded
automatically on first run. No database server to install. Swap `src/db.js`
for a real database later if you outgrow it.

## 1. Install

```bash
cd backend
npm install
cp .env.example .env
```

Open `.env` and set a real `JWT_SECRET` (and change `ADMIN_PASSWORD`):

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## 2. Run

```bash
npm start        # production
npm run dev       # auto-restarts on file changes (Node 18+)
```

You should see:

```
Seeded default admin account: admin@exceltravel.rw
Excel Travel & Tours fuel backend running at http://127.0.0.1:5000/api
```

## 3. Point the frontend at it

`js/config.js` already reads:

```js
const API_BASE_URL = window.API_BASE_URL || 'http://127.0.0.1:5000/api';
```

So as long as the backend runs on port 5000, the frontend needs no changes.
To use a different host/port (e.g. deploying), either edit `config.js`
directly or set `window.API_BASE_URL` in an inline `<script>` before it
loads.

## 4. Log in

- **Admin:** the email/password from `ADMIN_EMAIL` / `ADMIN_PASSWORD` in
  `.env` (defaults: `admin@exceltravel.rw` / `ChangeMe123!` — change this).
- **Agents:** register new accounts from `register.html` — they're always
  created with role `agent`.

## API reference

All routes are prefixed with `/api`. Authenticated routes expect
`Authorization: Bearer <token>`.

| Method | Path                  | Auth       | Description                          |
|--------|-----------------------|------------|---------------------------------------|
| GET    | `/health`             | none       | Health check                          |
| POST   | `/auth/register`      | none       | Create an agent account               |
| POST   | `/auth/login`         | none       | Returns `{ token, user }`             |
| GET    | `/auth/me`            | any        | Validates the current token           |
| POST   | `/auth/forgot`        | none       | Generates an 8-char reset code (15 min expiry) |
| POST   | `/auth/reset`         | none       | Resets password with the code         |
| GET    | `/entries`            | any        | Admin: all entries. Agent: own only   |
| POST   | `/entries`            | any        | Create a fuel entry (userId/cost server-derived) |
| DELETE | `/entries/:id`        | admin      | Delete an entry                       |
| GET    | `/fleet`               | admin      | List all buses                        |
| POST   | `/fleet`               | admin      | Add a bus                             |
| DELETE | `/fleet/:id`           | admin      | Remove a bus                          |

## Notes / next steps for production

- **Password reset codes** are currently returned directly in the API
  response (so the demo works without an email/SMS provider). Wire up a real
  mailer and stop returning `token` in the `/auth/forgot` response before
  shipping this for real users.
- **Storage**: `data/db.json` is fine for a small team but has no
  concurrency control — two simultaneous writes can race. For heavier
  traffic, move `src/db.js` to Postgres/MySQL/SQLite.
- **CORS**: set `CORS_ORIGIN` in `.env` to your real frontend origin instead
  of `*` once deployed.
- **JWT_SECRET**: must be a long random value in production, and kept out
  of version control (`.env` is already gitignored).
