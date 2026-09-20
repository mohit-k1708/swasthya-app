# Swasthya

A barcode-scanning web app. Scan a product barcode (camera or manual entry)
and get an instant A–E nutrition grade, powered by the Open Food Facts API.

- **Frontend**: React + Vite, at the repo root
- **Backend**: Express, in `server/`

These are two independent npm packages — install and run each separately.
See `CLAUDE.md` for architecture details.

## Local development

```bash
# Backend (terminal 1)
cd server
npm install
npm run dev          # http://localhost:4000

# Frontend (terminal 2), from repo root
npm install
npm run dev           # http://localhost:5173
```

No API keys are required — Open Food Facts is a free, keyless public API.

## Environment variables

| Where | Variable | Purpose | Required? |
|---|---|---|---|
| root | `VITE_API_URL` | Backend base URL the frontend calls | Only in production — defaults to `http://localhost:4000` |
| `server/` | `PORT` | Port the server listens on | No — defaults to `4000`; hosts like Railway set this automatically |
| `server/` | `NODE_ENV` | Standard Node environment flag | No |
| `server/` | `CORS_ORIGIN` | Origin allowed to call the API | No — defaults to `*` |

Copy `.env.example` → `.env` (root) and `server/.env.example` → `server/.env`
to override locally. Neither `.env` file is committed (see `.gitignore`).

## Deployment

### Backend → Railway

1. [railway.app](https://railway.app) → New Project → Deploy from GitHub repo.
2. Set the service's root directory to `server/`.
3. Environment variables (Railway dashboard → Variables): `NODE_ENV=production`.
   Leave `PORT` unset — Railway injects it automatically; the app already
   reads `process.env.PORT`.
4. Build/start commands: Railway auto-detects `npm install` + `npm start`
   from `server/package.json`.
5. Once deployed, copy the generated public URL (Settings → Networking →
   Generate Domain) — this is the backend URL for the next step.

### Frontend → Vercel

1. [vercel.com](https://vercel.com) → New Project → import the same GitHub repo.
2. **Root Directory**: leave as `.` (repo root) — the frontend is *not* in a
   `client/` folder in this project.
3. Framework preset: Vite (auto-detected). Build command `npm run build`,
   output directory `dist`.
4. Environment variable: `VITE_API_URL` = the Railway backend URL from above
   (e.g. `https://swasthya-api.up.railway.app`).
5. Deploy. Vercel gives you the live frontend URL.

### After deploying

Set the backend's `CORS_ORIGIN` (Railway) to the Vercel URL to lock down
cross-origin access once you know it, then redeploy the backend.
