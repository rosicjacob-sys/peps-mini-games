# Peps Mini Games

Promo mini-games for Shopify stores, hosted outside the theme. Edit rewards, odds, colours and text in the
dashboard: no theme edits, no redeploys. Each store loads games with one `<script>` line.

```
apps/api         Node + Express + Postgres  (odds, weekly limit, codes, weekly reminder emails via Resend, admin API)
apps/dashboard   React admin UI             (store groups, stores, games, rewards library, reports, players, reminders)
apps/widget      React → one widget.js      (the game players see; runs in a Shadow DOM)
packages/shared  themes, game types, EN/FR strings, card-game engines
render.yaml      Render Blueprint
.github/         CI: API tests against Postgres, dashboard and widget builds
```

## How it works
- **Store groups** (e.g. Lexar, Can Peps, Peps USA) are created in the dashboard; each store is assigned to one.
  **Games belong to a group**: every store in the group shows them, so adding a store needs no game setup (pick its
  group, enter its website, paste the install line). A group also carries the **"Play to Win" popup** its stores show
  and the default Resend sender (From name / email / reply-to) for its games' reminder emails; a game can override
  the sender. Plays, reports and reminders stay per store.
- **One play per email per week, across all stores of a group.** Weeks run Monday 12:00 AM → Sunday 11:59 PM ET
  (America/Toronto). A different email can play again. Gmail dots and `+tags` are normalised.
- A **store** has one website (its homepage) and can answer at other addresses too. Each address is kept with and
  without `www.`. The website is how the shared install line recognises the store, where the reminder email's
  "Play now" button goes, and where the store's brand colours are read from.
- **One install line for every store**: `<script src=".../widget.js" data-locale="{{ request.locale.iso_code }}" defer>`.
  The API finds the store from the page's website. `data-store="<key>"` still works and is needed only for a store
  with no website listed.
- **Install & check** (Stores): loads the store's site like a visitor and reports what stops the games from showing
  (no install line, address not listed, wrong key, outdated widget build, password page, no live games, live games
  without rewards, a Content-Security-Policy that blocks the widget). It then asks the games server for the store's
  games exactly as the widget would and lists what visitors get.
- **Preview** (any game, from its editor): opens the game in the real widget with a short-lived token. Nothing is
  recorded, any email works, paused games show too.
- **Rewards library**: rewards (EN/FR title + subtitle, code, slot icon) are entered once and added to any game; each
  game sets only the probability. Editing a library reward updates every game using it. Deleting one removes it from
  its games and moves its odds to "No reward" there.
- A game has **rewards** with a probability % each, plus a **"No reward" chance**; together they total 100%. The
  **server** rolls the outcome (the widget only animates it), so odds can't be tampered with in the browser. Every
  game except the wheel awards one reward per play. A lost play is lost in the game itself (dealer wins, no match,
  "Try again" slice) and ends on "Not this time: try again on <next Monday>".
- **Archive, don't delete.** Archiving a game or store hides it everywhere (sites, setup pages, filters) but keeps its
  plays and reminders in the reports; it can be restored. Only an archived game or store can be deleted for good.
- **Card rules.** Lucky 9: the player may draw unless they hold a natural 9; the banker draws on 0–5 and never ends on 9.
  Blackjack: the dealer never reaches 21 (the hand is a warm-up the player wins, then a wheel decides the reward).
  Baccarat: standard third-card rules; the banker never ends on 9. Poker: a paytable maps rewards to hands.
- The code is shown **on screen only** (no code email).
- **Weekly reminder email.** After each Monday reset, everyone who played a store's games the week before gets one
  email (Resend, from the game's sender) inviting them to play again; its "Play now" button opens the store with the
  game already open. Skipped: test emails, unsubscribed addresses (every email has an unsubscribe link and a one-click
  `List-Unsubscribe` header), archived stores, and anyone who already played again in the group that week. The API
  checks every 15 minutes, never sends a reminder twice and retries failures up to 3 times. Per game on/off + subject
  in **Reminder email**. `REMINDERS=off` pauses them all.

## Dashboard
- **Overview**: a setup checklist until the first game can be played, then KPI tiles with change vs the previous
  period (plays, unique/new/returning players, plays per player, reminder delivery), plays over time, insights,
  new vs returning players, a weekday × hour heatmap (ET), rewards won vs the probability you set (per game, across
  the stores that show it; flags only gaps beyond chance), breakdowns by group/store/game, language split and latest
  plays. Every chart has a table view. Each game's **Stats** tab shows the same, scoped to it.
- **Games**: cards flag what stops a game from showing. The editor has one Save for everything, warns before leaving
  with unsaved changes, and these tabs: General (name, status, archive) · Rewards · Look & sound · Texts ·
  Reminder email · Stats. A **Preview** button opens the game in the widget.
- **Players**: searchable directory with history (plays and reminders) per email. **Reminder emails**: every weekly
  reminder with its status and Resend's reason when one fails, a send button, "Send due reminders now".
- **Stores**: one card per store with **Install & check**; **Store groups**: sender defaults and the "Play to Win"
  popup (EN + FR copy, steps, image).
- One filter row scopes the reports: date range (ET presets or custom), store group, store, game (archived ones
  included). CSV exports follow it.

## Visitor flow
1. Visitor passes the theme's age verification.
2. On the **homepage only**, the group's "Play to Win" popup appears right away (once per visit). Visitors can switch
   EN / FR; their choice is remembered and also sets the language of their reminder email.
3. **Play now** → pick a game (when the group has several) → email step (privacy notice) → game → code on screen.
   **No thanks** closes it; the floating button stays. After a play the button reads "Come back Monday" until the
   next reset (a different email can still play). Escape closes any window; focus stays inside it.

The popup waits for the age gate by watching for an element matching `[id*="age-gate"], [class*="age-gate"], [data-age-gate]`
(matches the Lexar theme's `#meridian-age-gate`). If a store group's theme uses a different gate, set it on the script tag.

**Display font.** Headings and primary buttons use "Coffee Tin" when it is self-hosted in `apps/widget/public/fonts/`
(see the README there), otherwise "Rye" from Google Fonts. Arcade games use "Fredoka".

Optional attributes on the `<script>` tag:

| Attribute | Purpose |
|---|---|
| `data-locale` | Starting language (`en` / `fr`), e.g. `{{ request.locale.iso_code }}` |
| `data-age-selector` | CSS selector of that theme's age-verification dialog |
| `data-intro-pages` | `all` to show the popup on every page (default: homepage only) |
| `data-game` | Only offer one game type (`wheel`, `blackjack`, `slots`, `color`, `lucky9`, `baccarat`, `poker`, `scratch`, `gifts`, `plinko`, `spin`) |
| `data-api` | The API address, when it is not the one built into widget.js |
| `data-preview` | A preview token from the dashboard (set by the Preview page, not by hand) |

## Deploy on Render
1. Render → **New → Blueprint** → select this repo. It creates the database, API, dashboard and widget.
2. Fill the prompted env vars: `DASHBOARD_PASSWORD`, `RESEND_API_KEY`, `DASHBOARD_ORIGIN` (dashboard URL),
   and `VITE_API_URL` for both static sites (the API URL, e.g. `https://peps-games-api.onrender.com`).
3. Dashboard → **Store groups** → create the groups (sender, popup); **Rewards library** → the codes; **Games** →
   create games for a group, set rewards/odds, texts, look.
4. Dashboard → **Stores** → add each store (its group + website), then **Install & check**: paste the install line
   into `theme.liquid` before `</body>` and run the check. Verify the from-domain in Resend.

Changing a `VITE_*` var needs a redeploy of that static site.

**Database changes** run at API start: `schema.sql` is the idempotent baseline, and numbered files in
`apps/api/src/migrations/` are applied once each (recorded in `schema_migrations`). Add a new numbered file for any
change that must run exactly once.

**Test emails.** `mosada.jerome.d@gmail.com`, `vantatechca@gmail.com` and `rosicjacob@gmail.com` can play without
limit; their plays are not counted in stats, tallies or exports, and they never get reminder emails. Change the
list with `TEST_EMAILS=a@x.com,b@y.com` on the API service.

Other API settings: `PLAY_RATE_LIMIT` (default 20) caps plays per minute per IP; `LOGIN_RATE_LIMIT` (default 10)
caps wrong passwords per 15 minutes per IP; `CONFIG_CACHE_MS` (default 30000) is how long a store's game list is
cached between dashboard saves (saves clear it at once).

## Local dev
```
npm install
cp apps/api/.env.example apps/api/.env      # needs a local Postgres
npm run dev:api        # :3000
npm run dev:dashboard  # :5173
npm run dev:widget     # :5174  → /?store=<public_key>&api=http://localhost:3000
```

## Tests
```
npm test -w @peps/api                                                   # card engines, helpers
TEST_DATABASE_URL=postgres://.../peps_games_test npm test -w @peps/api  # + the HTTP API against Postgres (wipes that DB)
```
CI (GitHub Actions) runs both and builds the dashboard and the widget on every push.

## Games
Casino: Prize Wheel, Slot Machine, Color Game, Lucky 9, Baccarat, Poker, Blackjack (fixed purple theme).
Arcade: Scratch Card, Mystery Gift Boxes, Plinko, Lucky Spin. Arcade games can use a preset palette or
"Match my website": each store then shows them in its own brand colours, read from its homepage.
