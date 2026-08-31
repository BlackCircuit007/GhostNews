# PressClub / GhostNews

A news website that monetizes through **advertising impressions** and **paid membership**
("Payer" accounts). Built with plain HTML/CSS/JS + a Node.js/Express server.

## Quick start (local)

```bash
npm install
copy .env.example .env    # then fill in the values
npm run dev               # dev mode (auto-restart on file changes)
# or: npm start
```

Then open http://localhost:3000

## Pages

| Page | Purpose |
|------|---------|
| `/`            | Homepage with search + contact form |
| `/news.html`   | News feed, "Become Payer" modal, article reading |
| `/dashboard.html` | Payer dashboard (saved articles, streak, history) |
| `/stats.html`  | Owner monetization stats (payments + ad impressions) |
| `/payment-complete.html` | Auto-verifies Flutterwave payments on return |

## 1. Live news feed

1. Sign up at https://newsdata.io (free tier available)
2. Copy your API key
3. Set `NEWS_API_KEY` in `.env` (local) or Render Environment (deployed)

**Optional second source — GNews:** sign up at https://gnews.io (free tier
~100 req/day) and set `GNEWS_API_KEY`. Articles from both feeds are merged
(deduplicated by headline) so your site has more coverage.

**Payer gate:** free readers only see the first **10** news cards. Payers
(verified via their phone number) unlock the full merged feed.

Without a key, the site shows built-in sample articles.

## 2. Emails (contact form + payment verification)

The server tries **three** email channels, in order:

1. **SMTP** through `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` (e.g. Brevo SMTP)
2. **Brevo REST API** through `BREVO_API_KEY` (HTTPS fallback that works on Render free)
3. If neither is configured, requests are still recorded but **no email goes out**

Required env vars (see `.env.example`):
```
OWNER_EMAIL=your-email@gmail.com       # receives verification & contact emails
MAIL_FROM="PressClub <your-email@gmail.com>"
SMTP_HOST=smtp-relay.brevo.com
SMTP_USER=your-brevo-smtp-login
SMTP_PASS=xsmtpsib-...                 # Brevo SMTP key
BREVO_API_KEY=xkeysib-...              # optional HTTPS fallback
```

## 3. Ad monetization (earn from views)

### Monetag Multi-tag (the only ad network — real earnings)

Your Monetag account is wired in and the tag runs on **every page**
(home, news, dashboard, payment page) instead of only the home page:

- `MONETAG_ZONE_ID` + `MONETAG_TAG_URL` hold your zone (`274683`,
  `https://quge5.com/88/tag.min.js`); `monetag.js` injects the tag
  automatically — change the zone without touching HTML
- Push notification service worker is served at **`/sw.js`**
- Every monetized page view is counted at `/api/ads/impression`
  (ad id `monetag-multi-tag`), so your **owner dashboard** shows your total
  paid views; actual $ earnings are in your Monetag dashboard
- Payers can switch ads off for themselves in their dashboard
  (**Ad-free browsing**) — Monetag is then not loaded for that payer at all
- The old sample SVG banner ads were removed entirely

> Tip: don't paste the multi-tag `<script>` into HTML manually anymore —
> it would double-load against `monetag.js`.

### Owner dashboard (hidden behind your secret code)

There is **no stats link in the navigation** on purpose. To see your money:

1. Click **Login** (or go straight to `/stats.html`)
2. Enter your secret **owner code** (`OWNER_CODE` in `.env` / Render)
3. The owner dashboard unlocks: total collected, payers, ad impressions,
   ad revenue estimate, pending verifications and the full ledger

Owner endpoints (`/api/stats`, `/api/owner-stats`, `/api/ledger`) all
require the code (`X-Owner-Pass` header or `?pass=`).

## 4. Payments ("Become a Payer") — automated online payment

To let users pay instantly with **card / bank / USSD** via Flutterwave:

1. Create an account at https://dashboard.flutterwave.com
2. Get `FLUTTERWAVE_SECRET_KEY` (starts `FLWSECK-`) and `FLUTTERWAVE_PUBLIC_KEY` (starts `FLWPUBK-`)
3. Set a **webhook secret hash** in Flutterwave → Settings → Webhooks
4. Set the webhook URL to `https://YOUR-DOMAIN/api/flutterwave-webhook`
5. Add these to `.env` or Render Environment:
   ```
   FLUTTERWAVE_SECRET_KEY=FLWSECK-...
   FLUTTERWAVE_PUBLIC_KEY=FLWPUBK-...
   FLUTTERWAVE_SECRET_HASH=your-secret-hash
   PAYMENT_AMOUNT=5000
   ```

Flow: user clicks **"Pay Online Now"** → server creates a Flutterwave payment link →
user pays → Flutterwave webhook auto-verifies → `payment-complete.html` confirms →
user is logged in as a **Payer** immediately.

**Manual fallback:** if Flutterwave is not configured, the modal keeps the OPAY
transfer flow — the owner gets an email with a verification link and confirms manually.

## 5. Deployment (Render)

`render.yaml` is the Render Blueprint. Push this repo to GitHub, create a
**Blueprint** in Render, and it creates the service. Set these in Render →
Environment (or let the Blueprint prompt you):

- `OWNER_EMAIL`, `MAIL_FROM`, `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` (email)
- `NEWS_API_KEY` (live news — newsdata.io)
- `GNEWS_API_KEY` (optional second live news source — gnews.io)
- `FLUTTERWAVE_SECRET_KEY`, `FLUTTERWAVE_PUBLIC_KEY`, `FLUTTERWAVE_SECRET_HASH` (payments)
- `MONETAG_ZONE_ID`, `MONETAG_TAG_URL` (your Monetag zone)
- `OWNER_CODE` (secret code that unlocks the hidden owner stats)
- `DATABASE_URL` (CockroachDB — see below)

### CockroachDB (database-backed payments & stats)

1. Create a free **CockroachDB Cloud** cluster (Serverless tier is fine)
2. Copy the connection string and add it as `DATABASE_URL`, e.g.
   `postgresql://user:pass@free-tier.gcp.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full`
3. On first start the server creates a `pressclub_state` table and stores
   the payment ledger, pending verifications, verified tokens and ad stats there
4. If the DB is ever unreachable, the server automatically keeps working from
   the JSON files and merges everything back when the DB returns — no data lost

This fixes Render free tier's ephemeral disk: payer records survive restarts
and redeploys.

## API endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET  | `/api/news?q=...&date=...` | News proxy (key stays on server) |
| GET  | `/api/config` | Public config (Monetag zone) |
| GET  | `/api/ads` | Ad config (Monetag only — no banner ads) |
| POST | `/api/ads/impression` | Counts one ad view |
| POST | `/api/owner-auth` | Validates the owner code |
| GET  | `/api/stats?pass=...` | Ad impressions + revenue (**owner code required**) |
| GET  | `/api/owner-stats?pass=...` | Payers, money collected (**owner code required**) |
| GET  | `/api/ledger?pass=...` | Full transactions (**owner code required**) |
| POST | `/api/initiate-payment` | Creates Flutterwave payment link |
| POST | `/api/flutterwave-webhook` | Flutterwave auto-verification |
| GET  | `/api/payment-verify?tx_ref=...` | Check a payment status |
| POST | `/api/contact` | Contact form email |
| POST | `/api/request-verify` | Manual transfer verification request |
| GET  | `/api/check-token?token=...` | Poll for a verified payment |
| POST | `/api/login` | Login with phone (30-day subscription) |
| GET  | `/api/config` | Client config (ads enabled?, endpoint) |
| GET  | `/api/health` | Diagnostics for emails, ads, ledger |