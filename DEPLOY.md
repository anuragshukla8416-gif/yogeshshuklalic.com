# Deployment Guide — Yogesh Shukla Advisory Backend

The frontend (GitHub Pages) is static-only, so the backend needs a separate host that can run Node.js and Postgres. Three good options, cheapest/easiest first.

---

## Option A — Render (easiest, has a free Postgres tier)

1. Push this `backend/` folder to a GitHub repo (or a subfolder of your existing one).
2. On [render.com](https://render.com): **New → PostgreSQL** — create a database, note the **Internal Connection String**.
3. Open the Render **Shell** for that database (or use `psql` locally with the **External Connection String**) and run:
   ```bash
   psql "<connection-string>" -f db/schema.sql
   ```
4. **New → Web Service** → connect your repo, root directory `backend`.
   - Build command: `npm install`
   - Start command: `node server.js`
5. Add environment variables under **Environment** (same keys as `.env.example`):
   `DATABASE_URL` (the Internal Connection String), `JWT_SECRET`, `ADMIN_PIN`, `FRONTEND_ORIGIN`, `PGSSL=true`, and optionally the SMTP/MSG91/SendGrid keys.
6. Deploy. Render gives you a URL like `https://yogesh-advisory-api.onrender.com` — put that in the frontend's `assets/config.js` as `API_BASE_URL`.

---

## Option B — Railway

1. `railway init` in the `backend/` folder (or connect the GitHub repo via the Railway dashboard).
2. **Add a Plugin → PostgreSQL** — Railway provisions it and injects `DATABASE_URL` automatically into your service's environment.
3. Run the schema once, either via Railway's Postgres **Query** tab (paste the contents of `db/schema.sql`) or:
   ```bash
   railway run psql "$DATABASE_URL" -f db/schema.sql
   ```
4. Set the remaining environment variables (`JWT_SECRET`, `ADMIN_PIN`, `FRONTEND_ORIGIN`, etc.) in the Railway dashboard.
5. Railway auto-deploys on push. Copy the generated public URL into `assets/config.js`.

---

## Option C — Docker on any VPS

This repo already includes `Dockerfile` and `docker-compose.yml`, which run Postgres + the API together.

```bash
cd backend
cp .env.example .env      # fill in real values first
docker compose up -d --build
```

This starts Postgres on `5432` (auto-seeded from `db/schema.sql` on first boot) and the API on `4000`. Put a reverse proxy (Nginx/Caddy) in front for HTTPS, and point `assets/config.js` at your domain.

To update after a code change:
```bash
docker compose up -d --build api
```

---

## After deploying — checklist

- [ ] `curl https://your-backend-url/api/health` returns `{"success":true,...}`
- [ ] `assets/config.js` on the frontend points at the deployed `API_BASE_URL`
- [ ] `FRONTEND_ORIGIN` on the backend matches your actual GitHub Pages URL (CORS will silently block requests otherwise)
- [ ] `ADMIN_PIN` matches what you intend to use in the Admin Workspace
- [ ] SMTP/MSG91/SendGrid keys are set if you want real OTP delivery instead of dev-mode
- [ ] `.env` is in `.gitignore` and was never committed
