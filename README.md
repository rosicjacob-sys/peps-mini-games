# Peps Mini Games

Promo mini-games for Shopify stores, hosted outside the theme. Edit rewards, odds, colours and text in the
dashboard — no theme edits, no redeploys. Each store loads games with one `<script>` line.

```
apps/api         Node + Express + Postgres  (odds, weekly limit, codes, Resend email, admin API)
apps/dashboard   React admin UI             (stores, games, rewards/odds, players, CSV export)
apps/widget      React → one widget.js      (the game players see; runs in a Shadow DOM)
packages/shared  themes, game types, EN/FR strings
render.yaml      Render Blueprint
```

## How it works
- A **store** has a public key and one or more **games** (`wheel` now; `blackjack`, `slots` next).
- A game has **rewards**: bilingual title + subtitle, a code that already exists in your discount app, and a
  probability %. Active rewards must total 100%. `Rewards per play` controls how many are drawn per play.
- The **server** rolls the outcome (the widget only animates it), so odds can't be tampered with in the browser.
- **One play per email per game per week.** Weeks run Monday 12:00 AM → Sunday 11:59 PM ET (America/Toronto);
  codes are stated as single-use and expiring Sunday 11:59 PM ET. Gmail dots/`+tags` are normalised.
- The code is shown on screen and emailed through Resend (from-address is set per game).
- Dashboard → Players: plays, unique emails, tally per reward, emails per reward, CSV export.

## Deploy on Render
1. Render → **New → Blueprint** → select this repo. It creates the database, API, dashboard and widget.
2. Fill the prompted env vars: `DASHBOARD_PASSWORD`, `RESEND_API_KEY`, `DASHBOARD_ORIGIN` (dashboard URL),
   and `VITE_API_URL` for both static sites (the API URL, e.g. `https://peps-games-api.onrender.com`).
3. Dashboard → **Stores** → add a store, copy its snippet into `theme.liquid` before `</body>`.
4. Dashboard → **Games** → create a game, set rewards/odds, texts, from-email, theme.
   Verify the from-domain in Resend.

Changing a `VITE_*` var needs a redeploy of that static site.

## Local dev
```
npm install
cp apps/api/.env.example apps/api/.env      # needs a local Postgres
npm run dev:api        # :3000
npm run dev:dashboard  # :5173
npm run dev:widget     # :5174  → /?store=<public_key>&api=http://localhost:3000
```

## Roadmap
- [x] API, dashboard, wheel, EN/FR, weekly limit, Resend, CSV export
- [ ] Slot machine
- [ ] Blackjack (hit/stand, fixed purple theme; server decides the outcome, deal is arranged to match)
