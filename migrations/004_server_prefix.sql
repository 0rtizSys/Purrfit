-- Purrfit 3.0.0: per-server command prefix.
-- Commands are now typed in chat (`$>work`); only /help, /dashboard and /support
-- remain slash commands. Each server can change its prefix from the dashboard
-- or with the `prefix` command.
--   1 to 5 characters, no whitespace and none of: ` \ @ #
--   (the same rule lives in src/bot/framework/prefix.ts and in the web backend)
ALTER TABLE public.server_configurations
  ADD COLUMN IF NOT EXISTS prefix TEXT NOT NULL DEFAULT '$>'
  CHECK (char_length(prefix) BETWEEN 1 AND 5 AND prefix !~ '[[:space:]`\\@#]');
