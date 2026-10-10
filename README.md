# FitPulse - Gym Management Suite

Full-stack gym system: **Admin Panel + Member Portal**, Express + MongoDB backend, JWT login, animated frontend.

## Features

**Admin**
- Overview: animated counters, revenue chart (last 6 months), paid/pending split, recent payments
- Members: add / edit / delete, search, assign coach, set fee and due date
- Trainers: add / edit / delete, member count per coach
- Paid / Pending dues: filter, "Mark Paid" (auto-generates receipt + moves due date +1 month)
- Weekly Plans: edit workout + diet for every day (members see changes instantly)

**Member**
- Sign up or login with email/password
- Membership card with days-left ring and payment status
- Today's workout + diet highlighted, full weekly routine
- Receipts history, coach info, edit own profile

## Run locally

```bash
npm install
cp .env.example .env     # edit values
npm start                # http://localhost:3000
```

Demo logins (created on first run when the DB is empty):
- Admin: `admin@fitpulse.com` / `admin123`
- Member: `hamza@fitpulse.com` / `member123`

## Deploy on Railway

1. Push this folder to a GitHub repo.
2. Railway -> **New Project** -> **Deploy from GitHub repo**.
3. In the same project click **+ New** -> **Database** -> **MongoDB**.
4. Open your web service -> **Variables** and add:
   - `MONGODB_URI` = `${{MongoDB.MONGO_URL}}`  (reference to the Mongo service; rename the service part if yours differs)
   - `JWT_SECRET` = any long random string
   - `ADMIN_EMAIL` and `ADMIN_PASSWORD` = your real admin login
   - `SEED_DEMO` = `false` (to start with an empty gym)
5. Settings -> Networking -> **Generate Domain**. Done.

Railway sets `PORT` automatically. The health check is `/api/health`.

## Project structure

```
server.js            Express app + Mongo connection
seed.js              Admin account, weekly plans, optional demo data
middleware/auth.js   JWT sign/verify, admin guard
models/              User, Trainer, Plan, Payment
routes/              auth, admin, member
public/              index.html, css/style.css, js/app.js (frontend)
```

## API summary

| Method | Route | Access |
|---|---|---|
| POST | /api/auth/login, /api/auth/register | public |
| GET | /api/auth/me | logged in |
| GET | /api/admin/stats | admin |
| GET/POST/PUT/DELETE | /api/admin/members(/:id) | admin |
| GET/POST/PUT/DELETE | /api/admin/trainers(/:id) | admin |
| GET | /api/admin/payments, /api/admin/payments/history | admin |
| POST | /api/admin/payments/:id/pay, /unpay | admin |
| GET/PUT | /api/admin/plans(/:day) | admin |
| GET | /api/member/dashboard | member |
| PUT | /api/member/profile | member |
