-- Purrfit 2.0.0: simulated crypto market, bank interest and taxes.

-- Per-server economy policy.
--   tax_bps:           tax on /transfer and on crypto sales, in basis points (100 = 1%), max 50%
--   bank_interest_bps: daily interest paid on bank balances, in basis points, max 5%/day
--   treasury:          money collected through taxes (removed from circulation)
ALTER TABLE public.server_configurations
  ADD COLUMN IF NOT EXISTS tax_bps           INTEGER NOT NULL DEFAULT 0  CHECK (tax_bps BETWEEN 0 AND 5000),
  ADD COLUMN IF NOT EXISTS bank_interest_bps INTEGER NOT NULL DEFAULT 10 CHECK (bank_interest_bps BETWEEN 0 AND 500),
  ADD COLUMN IF NOT EXISTS treasury          BIGINT  NOT NULL DEFAULT 0  CHECK (treasury >= 0);

-- Simulated coins. Prices are global (the same in every server); holdings are per server.
CREATE TABLE IF NOT EXISTS public.crypto_assets (
  symbol      TEXT           PRIMARY KEY,
  name        TEXT           NOT NULL,
  price       NUMERIC(20, 6) NOT NULL CHECK (price > 0),
  base_price  NUMERIC(20, 6) NOT NULL CHECK (base_price > 0),
  volatility  NUMERIC(8, 6)  NOT NULL CHECK (volatility >= 0),
  updated_at  TIMESTAMPTZ    NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.crypto_price_history (
  symbol      TEXT           NOT NULL REFERENCES public.crypto_assets (symbol) ON DELETE CASCADE,
  recorded_at TIMESTAMPTZ    NOT NULL,
  price       NUMERIC(20, 6) NOT NULL CHECK (price > 0),
  PRIMARY KEY (symbol, recorded_at)
);

CREATE TABLE IF NOT EXISTS public.crypto_holdings (
  user_id    TEXT           NOT NULL,
  guild_id   TEXT           NOT NULL,
  symbol     TEXT           NOT NULL REFERENCES public.crypto_assets (symbol) ON DELETE CASCADE,
  quantity   NUMERIC(30, 8) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  cost_basis BIGINT         NOT NULL DEFAULT 0 CHECK (cost_basis >= 0),
  PRIMARY KEY (user_id, guild_id, symbol)
);

-- Background jobs claim their run here, so two bot instances (e.g. during a
-- deploy) never run the same job twice.
CREATE TABLE IF NOT EXISTS public.scheduled_jobs (
  name     TEXT        PRIMARY KEY,
  last_run TIMESTAMPTZ NOT NULL
);

INSERT INTO public.scheduled_jobs (name, last_run) VALUES
  ('crypto_tick',  'epoch'),
  ('bank_interest', 'epoch')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.crypto_assets (symbol, name, price, base_price, volatility) VALUES
  ('PURR', 'Purrcoin',     1000,  1000,  0.060000),
  ('MEOW', 'Meowthereum',  250,   250,   0.080000),
  ('WSK',  'Whisker Token', 40,   40,    0.120000),
  ('NIP',  'Catnip',       2.5,   2.5,   0.200000),
  ('TUNA', 'Tuna Stable',  1,     1,     0.005000)
ON CONFLICT (symbol) DO NOTHING;

-- Leaderboard reads balances per server
CREATE INDEX IF NOT EXISTS clients_guild_idx ON public.clients (guild_id);
CREATE INDEX IF NOT EXISTS crypto_holdings_user_idx ON public.crypto_holdings (user_id, guild_id);

ALTER TABLE public.crypto_assets        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crypto_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crypto_holdings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_jobs       ENABLE ROW LEVEL SECURITY;
