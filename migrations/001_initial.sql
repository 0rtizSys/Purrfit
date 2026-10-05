-- Purrfit: initial schema (clients, cooldowns, server settings).
-- Safe to run on a database that already has these tables.

-- Saldos de cada usuario por servidor
CREATE TABLE IF NOT EXISTS public.clients (
  user_id  TEXT   NOT NULL,
  guild_id TEXT   NOT NULL,
  wallet   BIGINT NOT NULL DEFAULT 0 CHECK (wallet >= 0),
  bank     BIGINT NOT NULL DEFAULT 0 CHECK (bank >= 0),
  PRIMARY KEY (user_id, guild_id)
);

-- Fin del cooldown de /work (epoch en milisegundos)
CREATE TABLE IF NOT EXISTS public.cooldowns_table (
  guild_id TEXT   NOT NULL,
  user_id  TEXT   NOT NULL,
  cooldown BIGINT NOT NULL,
  PRIMARY KEY (guild_id, user_id)
);

-- Configuración de cada servidor
CREATE TABLE IF NOT EXISTS public.server_configurations (
  guild_id       TEXT    PRIMARY KEY,
  cooldown_time  INTEGER NOT NULL DEFAULT 1800 CHECK (cooldown_time > 0),
  economy_symbol TEXT    NOT NULL DEFAULT '$' CHECK (char_length(economy_symbol) BETWEEN 1 AND 2)
);

-- Bloquea el acceso desde la API pública de Supabase.
-- El bot se conecta con DATABASE_URL (rol postgres), así que no le afecta.
ALTER TABLE public.clients               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cooldowns_table       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.server_configurations ENABLE ROW LEVEL SECURITY;
