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
- **Store groups** (e.g. Lexar, Can Peps, Peps USA) are created in the dashboard; each store is assigned to one. A group
  carries the default Resend sender (From name / email / reply-to) for every game in its stores; a game can override it.
- A **store** has a public key and one or more **games** (`wheel`, `blackjack`, `slots`).
- A game has **rewards**: bilingual title + subtitle, a code that already exists in your discount app, and a
  probability %. Active rewards must total 100%. `Rewards per play` controls how many are drawn per play.
- The **server** rolls the outcome (the widget only animates it), so odds can't be tampered with in the browser.
- **One play per email per game per week.** Weeks run Monday 12:00 AM → Sunday 11:59 PM ET (America/Toronto);
  codes are stated as single-use and expiring Sunday 11:59 PM ET. Gmail dots/`+tags` are normalised.
- The code is shown on screen and emailed through Resend (from-address is set per game).
- Dashboard → Players: plays, unique emails, tally per reward, emails per reward, CSV export.

## Dashboard
- **Overview** — KPI tiles with change vs the previous period (plays, unique/new/returning players, plays per player,
  email delivery), plays over time against the previous period, insights, new vs returning players, a weekday × hour
  heatmap (ET), rewards won vs the probability you set (flags only gaps beyond chance), breakdowns by group/store/game,
  language split and latest plays. Every chart has a table view. Each game's **Stats** tab shows the same, scoped to it.
- **Players** — searchable directory with history per email; **Email delivery** — failures with Resend's reason and a resend button.
- One filter row scopes everything: date range (ET presets or custom), store group, store, game. CSV exports follow it.

## Visitor flow
1. Visitor passes the theme's age verification.
2. On the **homepage only**, a "Play to Win" popup appears right away (once per visit). Copy, steps, buttons and an
   optional image are edited per game in the dashboard (**Intro popup** tab, English + French). Visitors can switch
   EN / FR with the toggle; their choice is remembered and also sets the language of the code email.
3. **Play now** → email step (privacy notice) → game → code on screen + by email. **No thanks** closes it; the floating
   button stays. The popup does not return the same visit, and stays away after a play until the next week.

The popup waits for the age gate by watching for an element matching `[id*="age-gate"], [class*="age-gate"], [data-age-gate]`
(matches the Lexar theme's `#meridian-age-gate`). If a store group's theme uses a different gate, set it on the script tag.

**Display font.** Headings and primary buttons use "Coffee Tin" when it is self-hosted in `apps/widget/public/fonts/`
(see the README there), otherwise "Rye" from Google Fonts.

Optional attributes on the `<script>` tag:

| Attribute | Purpose |
|---|---|
| `data-locale` | Starting language (`en` / `fr`), e.g. `{{ request.locale.iso_code }}` |
| `data-age-selector` | CSS selector of that theme's age-verification dialog |
| `data-intro-pages` | `all` to show the popup on every page (default: homepage only) |
| `data-game` | Only offer one game type (`wheel`, `blackjack`, `slots`) |

## Deploy on Render
1. Render → **New → Blueprint** → select this repo. It creates the database, API, dashboard and widget.
2. Fill the prompted env vars: `DASHBOARD_PASSWORD`, `RESEND_API_KEY`, `DASHBOARD_ORIGIN` (dashboard URL),
   and `VITE_API_URL` for both static sites (the API URL, e.g. `https://peps-games-api.onrender.com`).
3. Dashboard → **Stores** → add a store, copy its snippet into `theme.liquid` before `</body>`.
4. Dashboard → **Games** → create a game, set rewards/odds, texts, from-email, theme.
   Verify the from-domain in Resend.

Changing a `VITE_*` var needs a redeploy of that static site.

**Test emails.** `mosada.jerome.d@gmail.com`, `vantatechca@gmail.com` and `rosicjacob@gmail.com` can play without
limit; their plays are not counted in stats, tallies or exports, and they still receive the code email. Change the
list with `TEST_EMAILS=a@x.com,b@y.com` on the API service.

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
- [x] Slot machine (one payline; all three reels stop on the winning reward's symbol)
- [x] Blackjack (the player wins a warm-up hand with hit/stand, then spins the wheel that decides the reward; fixed purple theme)
