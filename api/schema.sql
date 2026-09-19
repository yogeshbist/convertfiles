-- One row per (day, metric, key). Nothing else is ever stored: no IPs, no file
-- names, no file contents, no user identifiers.
CREATE TABLE IF NOT EXISTS daily (
  day    TEXT    NOT NULL,              -- YYYY-MM-DD (UTC)
  metric TEXT    NOT NULL,              -- views | uniq | conv | fail | pair | page | device | ref | failpair
  key    TEXT    NOT NULL DEFAULT '',   -- e.g. 'heic>jpg' for pair, '/mov-to-mp4/' for page
  n      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, metric, key)
);
CREATE INDEX IF NOT EXISTS daily_metric_day ON daily (metric, day);

-- Ratings and comments people leave. Shown on the site (hidden = 0). The only
-- per-visitor value is iph, a salted daily hash used for a submissions-per-day
-- limit; it cannot be turned back into an address and is meaningless after the day.
CREATE TABLE IF NOT EXISTS feedback (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  ts     INTEGER NOT NULL,              -- unix ms
  stars  INTEGER NOT NULL,              -- 1..5
  text   TEXT    NOT NULL DEFAULT '',
  name   TEXT    NOT NULL DEFAULT '',
  page   TEXT    NOT NULL DEFAULT '',   -- where it was left, e.g. /compress-image/
  hidden INTEGER NOT NULL DEFAULT 0,
  iph    TEXT    NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS feedback_ts ON feedback (ts);
