# Peps Mini Games

Promo mini-games for Shopify stores, hosted outside the theme. Edit rewards, odds, colours and text in the
dashboard: no theme edits, no redeploys. Each store loads games with one `<script>` line.

```
apps/api         Node + Express + Postgres  (odds, weekly limit, codes, weekly reminder emails via Resend, admin API)
apps/dashboard   React admin UI             (stores, games, rewards/odds, players, CSV export)
apps/widget      React → one widget.js      (the game players see; runs in a Shadow DOM)
packages/shared  themes, game types, EN/FR strings
render.yaml      Render Blueprint
```

## How it works
- **Store groups** (e.g. Lexar, Can Peps, Peps USA) are created in the dashboard; each store is assigned to one.
  **Games belong to a group**: every store in the group shows them, so adding a store needs no game setup (pick its
  group, list its website, paste the install line). A group also carries the default Resend sender (From name / email /
  reply-to) for its games; a game can override it. Plays, the weekly limit, reports and reminders stay per store.
- **Arcade colours**: an arcade game uses a preset palette, or "Match my website": each store then shows it in its own
  brand colours, read automatically from the store's homepage (on save, at startup, and on first widget load; editable
  or re-detected per store on the Stores page). Stores without colours use the game's palette.
- **Check install** (Stores): loads the store's site like a visitor and reports what stops the games from showing
  (no install line, address not listed incl. www., wrong key, outdated widget build, password page, no live games).
- **One install line for every store**: `<script src=".../widget.js" data-locale="{{ request.locale.iso_code }}" defer>`.
  The API finds the store from the page's website (the store's listed websites; each can belong to one store).
  `data-store="<key>"` still works and is needed only for a store with no website listed.
- **Rewards library**: rewards (EN/FR title + subtitle, code, slot icon) are entered once and added to any game; each
  game sets only the probability. Editing a library reward updates every game using it. "Import from my games" turns
  rewards already typed into games into library entries and links them. One-off rewards can still be custom per game.
- A **store** has a public key and one or more **games** (`wheel`, `blackjack`, `slots`).
- A game has **rewards**: bilingual title + subtitle, a code that already exists in your discount app, and a
  probability %. Active rewards must total 100%. `Rewards per play` controls how many are drawn per play.
- The **server** rolls the outcome (the widget only animates it), so odds can't be tampered with in the browser.
- **Losing.** Each game has a "No reward" chance next to the reward probabilities (together they total 100%). A lost
  play is lost in the game itself (dealer/banker wins, no match, no winning hand, or "Try again" on the wheel) and ends on "Not this time: try again on <next Monday>" with a note about weekly promotions. It still uses
  that week's play. Reports show "No reward (lost)" per game against the chance you set.
- **Card rules.** Lucky 9: the player may draw unless they hold a natural 9; the banker draws on 0–5 and never ends on 9.
  Blackjack: the dealer never reaches 21. Baccarat: standard third-card rules; the banker never ends on 9.
- **One play per email per week, across all of a store's games.** Weeks run Monday 12:00 AM → Sunday 11:59 PM ET
  (America/Toronto); a different email can play again. Gmail dots/`+tags` are normalised.
- The code is shown **on screen only** (no code email).
- **Weekly reminder email.** After each Monday reset, everyone who played a store's games the week before gets one
  email (Resend, from the game's sender) inviting them to play again; its "Play now" button opens the store with the
  game already open. Skipped: test emails, unsubscribed addresses (every email has an unsubscribe link and a one-click
  `List-Unsubscribe` header) and anyone who already played again. The API checks every 15 minutes, never sends a
  reminder twice and retries failures up to 3 times. Per game on/off + subject in **Texts & Email**; the link is the
  store's "Link in reminder emails". `REMINDERS=off` pauses them all.
- Dashboard → Players: plays, unique emails, tally per reward, emails per reward, CSV export.

## Dashboard
- **Overview**: KPI tiles with change vs the previous period (plays, unique/new/returning players, plays per player,
  reminder delivery), plays over time against the previous period, insights, new vs returning players, a weekday × hour
  heatmap (ET), rewards won vs the probability you set (flags only gaps beyond chance), breakdowns by group/store/game,
  language split and latest plays. Every chart has a table view. Each game's **Stats** tab shows the same, scoped to it.
- **Players**: searchable directory with history (plays and reminders) per email; **Reminder emails**: every weekly
  reminder with its status, Resend's reason when one fails, a send button, "Send due reminders now" and a preview per game.
- One filter row scopes everything: date range (ET presets or custom), store group, store, game. CSV exports follow it.

## Visitor flow
1. Visitor passes the theme's age verification.
2. On the **homepage only**, a "Play to Win" popup appears right away (once per visit). Copy, steps, buttons and an
   optional image are edited per game in the dashboard (**Intro popup** tab, English + French). Visitors can switch
   EN / FR with the toggle; their choice is remembered and also sets the language of their reminder email.
3. **Play now** → email step (privacy notice) → game → code on screen. **No thanks** closes it; the floating
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
3. Dashboard → **Store groups** → create the groups; **Games** → create games for a group, set rewards/odds, texts,
   from-email, theme.
4. Dashboard → **Stores** → add each store (its group + website), paste the shared install line into `theme.liquid`
   before `</body>`.
   Verify the from-domain in Resend.

Changing a `VITE_*` var needs a redeploy of that static site.

**Test emails.** `mosada.jerome.d@gmail.com`, `vantatechca@gmail.com` and `rosicjacob@gmail.com` can play without
limit; their plays are not counted in stats, tallies or exports, and they never get reminder emails. Change the
list with `TEST_EMAILS=a@x.com,b@y.com` on the API service. `PLAY_RATE_LIMIT` (default 20) caps plays per minute per IP.

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
- [x] Color Game (each reward sits on one of six colours; two or three dice of a colour win it; max 6 rewards)
- [x] Lucky 9 (draw or stand, closest to 9; the player wins, then spins the wheel for the reward)
- [x] Baccarat (bet Player / Banker / Tie, standard third-card rules; the bet wins, then the wheel decides the reward)
- [x] Poker (5 cards, no draw; a paytable maps each reward to a hand: rarer reward, better hand)
- [x] Blackjack (the player wins a warm-up hand with hit/stand, then spins the wheel that decides the reward; fixed purple theme)
