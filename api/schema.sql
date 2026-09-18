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
