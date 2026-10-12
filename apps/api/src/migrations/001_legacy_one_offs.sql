-- One-off data fixes that used to live in schema.sql and ran again at every start.
-- (The theme sweeps reset any Prize Wheel set to Emerald back to Burgundy on each deploy.)
-- They run exactly once here; databases that already had them applied see no change.
UPDATE games SET theme = 'emerald' WHERE theme IN ('pearl', 'ivory', 'stone', 'silver', 'graphite', 'midnight');
UPDATE games SET theme = 'burgundy' WHERE type = 'wheel' AND theme = 'emerald';
UPDATE plays p SET store_id = g.store_id FROM games g WHERE p.store_id IS NULL AND g.id = p.game_id AND g.store_id IS NOT NULL;
