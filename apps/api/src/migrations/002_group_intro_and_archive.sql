-- The "Play to Win" intro popup belongs to the store group (a store shows one popup whatever games the group has).
-- Each group takes the intro of its first live game: that is the one visitors were seeing.
ALTER TABLE store_groups ADD COLUMN IF NOT EXISTS intro jsonb NOT NULL DEFAULT '{}';
UPDATE store_groups sg SET intro = g.intro
  FROM (SELECT DISTINCT ON (group_id) group_id, texts->'intro' AS intro FROM games
        WHERE group_id IS NOT NULL AND texts ? 'intro' ORDER BY group_id, (status = 'active') DESC, created_at) g
  WHERE g.group_id = sg.id AND sg.intro = '{}'::jsonb;
UPDATE games SET texts = texts - 'intro' WHERE texts ? 'intro';

-- Archiving replaces deleting: an archived store or game disappears from the sites and the setup pages,
-- but its plays and reminders stay in the reports.
ALTER TABLE stores ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE games ADD COLUMN IF NOT EXISTS archived_at timestamptz;
