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
