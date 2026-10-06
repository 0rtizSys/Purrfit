-- Purrfit 3.0.0: the servers the bot is in.
-- The bot keeps this table up to date (on start, when it joins, leaves or a
-- server is renamed). The web dashboard reads it to know which of a user's
-- servers have Purrfit, so it never needs the bot token.
--   left_at IS NULL means the bot is in the server right now.
CREATE TABLE IF NOT EXISTS public.bot_guilds (
  guild_id     TEXT        PRIMARY KEY CHECK (guild_id ~ '^[0-9]{15,25}$'),
  name         TEXT        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  icon_hash    TEXT        CHECK (icon_hash IS NULL OR icon_hash ~ '^(a_)?[0-9a-f]{32}$'),
  member_count INTEGER     NOT NULL DEFAULT 0 CHECK (member_count >= 0),
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at      TIMESTAMPTZ,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bot_guilds_active_idx ON public.bot_guilds (guild_id) WHERE left_at IS NULL;

ALTER TABLE public.bot_guilds ENABLE ROW LEVEL SECURITY;
