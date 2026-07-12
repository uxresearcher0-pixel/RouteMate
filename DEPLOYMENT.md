# Deploying RouteMate → routemate.shahriarshanto.online

Production stack: **Vercel** (app, from the GitHub repo) + **MongoDB Atlas**
(free M0 cluster). The app reads two environment variables:

| Env var       | Purpose                                                        |
| ------------- | -------------------------------------------------------------- |
| `MONGODB_URI` | Atlas connection string (falls back to localhost in dev)       |

Authentication (since 2026-07-12): username/password. Users sign in with their
**Employee ID or mobile number + password** (bcrypt-hashed in MongoDB). Seeded
users get the initial password `RouteMate@<empCode>` (e.g. `RouteMate@E001`)
and change it from their profile page; the admin can set/reset any password
from the Admin → Employees form. The earlier `ACCESS_CODE` gate is retired.

## 1. Database — MongoDB Atlas (one of two ways)

**Option A (assisted):** run `atlas auth login` in a terminal (browser opens,
one click). Then Claude can run the rest from the CLI: create the free M0
cluster, database user, network access (0.0.0.0/0 so Vercel can connect),
fetch the connection string, and seed the demo data.

**Option B (manual):** at cloud.mongodb.com → create a free **M0** cluster →
Database Access: add a user (password auth) → Network Access: allow
`0.0.0.0/0` → Connect → Drivers → copy the connection string, e.g.
`mongodb+srv://USER:PASS@cluster0.xxxxx.mongodb.net/transport`.
(Keep `/transport` as the database name.)

Seed production data from this machine:

```bash
cd web
MONGODB_URI="mongodb+srv://USER:PASS@.../transport" npm run seed
```

## 2. App — Vercel (GitHub import, ~2 minutes)

1. vercel.com → **Add New → Project** → Import `uxresearcher0-pixel/RouteMate`.
2. **Root Directory: `web`** (important — the app lives in the subfolder).
   Framework auto-detects as Next.js; leave build settings alone.
3. Environment Variables: add `MONGODB_URI` (from step 1) and `ACCESS_CODE`
   (any secret code you'll share with employees).
4. Deploy. Every future `git push` to `main` auto-deploys.

## 3. Domain — routemate.shahriarshanto.online

1. In the Vercel project → **Settings → Domains** → add
   `routemate.shahriarshanto.online`.
2. At the DNS provider for `shahriarshanto.online`, add the record Vercel
   shows — normally: **CNAME** `routemate` → `cname.vercel-dns.com`.
3. Wait for DNS to propagate (usually minutes); Vercel provisions HTTPS
   automatically.

## Security notes for going live

- Per-user passwords are live; SSO or SMS-OTP can replace/augment them later
  (OTP needs an SMS gateway account — Twilio, SSL Wireless, etc.).
- The Atlas `0.0.0.0/0` allowlist is required because Vercel has no fixed
  egress IPs; the DB user's password is the actual protection.
- Never commit `MONGODB_URI` — it lives only in Vercel env settings (the
  repo's `.gitignore` already excludes `.env*`).
