-- Purrfit 2.2.0: bot heartbeat.
-- The bot writes one row per process every 30 seconds. Whoever needs to know
-- whether the bot is really alive (a dashboard, a monitor) reads this table:
-- a web server being up says nothing about the bot being up.
--   beat_at is set with the database clock (now()), so readers can compute the age
--   of a heartbeat in SQL without trusting the clocks of two different hosts.
CREATE TABLE IF NOT EXISTS public.bot_heartbeat (
  instance_id   TEXT        PRIMARY KEY,
  started_at    TIMESTAMPTZ NOT NULL,
  beat_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  status        TEXT        NOT NULL CHECK (status IN ('starting', 'running', 'stopping')),
  discord_ready BOOLEAN     NOT NULL DEFAULT false,
  ping_ms       INTEGER     CHECK (ping_ms IS NULL OR ping_ms >= 0),
  guilds        INTEGER     NOT NULL DEFAULT 0 CHECK (guilds >= 0),
  users         INTEGER     NOT NULL DEFAULT 0 CHECK (users >= 0),
  version       TEXT,
  environment   TEXT,
  rss_mb        INTEGER     CHECK (rss_mb IS NULL OR rss_mb >= 0),
  last_event_at TIMESTAMPTZ,
  last_event    TEXT
);

CREATE INDEX IF NOT EXISTS bot_heartbeat_beat_idx ON public.bot_heartbeat (beat_at DESC);

ALTER TABLE public.bot_heartbeat ENABLE ROW LEVEL SECURITY;
