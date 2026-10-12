CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  public_key text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(12), 'hex'),
  allowed_origins text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  type text NOT NULL,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active',          -- active | paused
  theme text NOT NULL DEFAULT 'pearl',
  brand_accent text,                              -- optional #hex override
  rewards_per_play int NOT NULL DEFAULT 1,
  texts jsonb NOT NULL DEFAULT '{}',              -- {heading:{en,fr}, subheading:{en,fr}, privacy:{en,fr}, privacyUrl, triggerLabel:{en,fr}}
  from_name text NOT NULL DEFAULT '',
  from_email text NOT NULL DEFAULT '',
  reply_to text NOT NULL DEFAULT '',
  email_subject jsonb NOT NULL DEFAULT '{}',      -- {en,fr}
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  title jsonb NOT NULL,                           -- {en,fr}
  subtitle jsonb NOT NULL DEFAULT '{}',           -- {en,fr}
  code text NOT NULL,
  probability numeric(6,3) NOT NULL DEFAULT 0,    -- percent, active rewards must sum to 100
  active boolean NOT NULL DEFAULT true,
  sort int NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS rewards_game_idx ON rewards(game_id);

CREATE TABLE IF NOT EXISTS plays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  email text NOT NULL,
  email_norm text NOT NULL,
  week_key text NOT NULL,                         -- Monday of the play week (America/Toronto)
  locale text NOT NULL DEFAULT 'en',
  ip_hash text,
  email_status text NOT NULL DEFAULT 'pending',   -- pending | sent | failed
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (game_id, email_norm, week_key)
);
CREATE INDEX IF NOT EXISTS plays_game_idx ON plays(game_id, created_at DESC);

CREATE TABLE IF NOT EXISTS play_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  play_id uuid NOT NULL REFERENCES plays(id) ON DELETE CASCADE,
  game_id uuid NOT NULL,
  reward_id uuid REFERENCES rewards(id) ON DELETE SET NULL,
  title jsonb NOT NULL,                           -- snapshot so history survives edits
  subtitle jsonb NOT NULL DEFAULT '{}',
  code text NOT NULL
);
CREATE INDEX IF NOT EXISTS play_rewards_game_idx ON play_rewards(game_id, reward_id);

-- blackjack: which hand result a reward is shown with (blackjack | win | push | loss)
ALTER TABLE rewards ADD COLUMN IF NOT EXISTS outcome text;

-- slots: the symbol shown on the reels for this reward
ALTER TABLE rewards ADD COLUMN IF NOT EXISTS symbol text;

-- internal test emails: not counted in stats or exports
ALTER TABLE plays ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

-- store groups: Lexar, Can Peps, Peps USA, ... Each carries the default Resend sender for its stores' games.
CREATE TABLE IF NOT EXISTS store_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  from_name text NOT NULL DEFAULT '',
  from_email text NOT NULL DEFAULT '',
  reply_to text NOT NULL DEFAULT '',
  sort int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE stores ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES store_groups(id) ON DELETE SET NULL;

-- casino palettes replaced the neutral ones
ALTER TABLE games ALTER COLUMN theme SET DEFAULT 'emerald';
UPDATE games SET theme = 'emerald' WHERE theme IN ('pearl', 'ivory', 'stone', 'silver', 'graphite', 'midnight');

-- each game type has its own default: wheels that were swept onto Emerald go to Burgundy
UPDATE games SET theme = 'burgundy' WHERE type = 'wheel' AND theme = 'emerald';

-- email delivery details (reason shown in the dashboard; resends counted)
ALTER TABLE plays ADD COLUMN IF NOT EXISTS email_error text;
ALTER TABLE plays ADD COLUMN IF NOT EXISTS email_attempts int NOT NULL DEFAULT 1;
ALTER TABLE plays ADD COLUMN IF NOT EXISTS last_email_at timestamptz;
-- reporting
CREATE INDEX IF NOT EXISTS plays_created_idx ON plays(created_at);
CREATE INDEX IF NOT EXISTS plays_email_idx ON plays(email_norm);
CREATE INDEX IF NOT EXISTS play_rewards_play_idx ON play_rewards(play_id);

-- chance (percent) that a play wins nothing; active reward probabilities + lose_percent = 100
ALTER TABLE games ADD COLUMN IF NOT EXISTS lose_percent numeric(6,3) NOT NULL DEFAULT 0;

-- shared rewards library: entered once, picked by any game (each game keeps its own probability)
CREATE TABLE IF NOT EXISTS reward_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title jsonb NOT NULL,                 -- {en,fr}
  subtitle jsonb NOT NULL DEFAULT '{}', -- {en,fr}
  code text NOT NULL,
  symbol text,                          -- default slot icon
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE rewards ADD COLUMN IF NOT EXISTS library_id uuid REFERENCES reward_library(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS rewards_library_idx ON rewards(library_id);

-- weekly "play again" reminders (they replaced code emails): one per store + email + week,
-- sent after the Monday reset to whoever played that store's games the week before
CREATE TABLE IF NOT EXISTS reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  game_id uuid REFERENCES games(id) ON DELETE SET NULL,   -- the game they played; its sender and look are used
  email text NOT NULL,
  email_norm text NOT NULL,
  locale text NOT NULL DEFAULT 'en',
  week_key text NOT NULL,                                 -- the week the reminder invites them to play
  status text NOT NULL DEFAULT 'pending',                 -- pending | sent | failed | skipped
  error text,
  attempts int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  UNIQUE (store_id, email_norm, week_key)
);
CREATE INDEX IF NOT EXISTS reminders_created_idx ON reminders(created_at DESC);
CREATE INDEX IF NOT EXISTS reminders_email_idx ON reminders(email_norm);
CREATE TABLE IF NOT EXISTS unsubscribes (
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  email_norm text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (store_id, email_norm)
);
-- where the reminder's "Play now" button goes (falls back to the store's first allowed address)
ALTER TABLE stores ADD COLUMN IF NOT EXISTS site_url text;

-- games belong to a store group: every store in the group shows them (set up once, no per-store setup)
ALTER TABLE games ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES store_groups(id);
ALTER TABLE games ALTER COLUMN store_id DROP NOT NULL;   -- legacy: the store a game was first made for
CREATE INDEX IF NOT EXISTS games_group_idx ON games(group_id);
-- a play remembers the store it happened on (games are shared by the group's stores)
ALTER TABLE plays ADD COLUMN IF NOT EXISTS store_id uuid REFERENCES stores(id) ON DELETE CASCADE;
UPDATE plays p SET store_id = g.store_id FROM games g WHERE p.store_id IS NULL AND g.id = p.game_id AND g.store_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS plays_store_week_idx ON plays(store_id, email_norm, week_key);
-- one play per email per *store* per week is enforced in /play (under a lock); the old per-game rule would wrongly
-- block the same game on a second store of the group
ALTER TABLE plays DROP CONSTRAINT IF EXISTS plays_game_id_email_norm_week_key_key;
