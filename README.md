# Purrfit

Purrfit is a Discord economy bot built with TypeScript, `discord.js` v14 and PostgreSQL.
Every server gets its own economy: members work for money, save it in the bank (which pays daily interest), send it to each other, gamble it on a coinflip and trade simulated cryptocurrencies with live price charts. Admins set the rules: currency symbol, work cooldown, taxes and interest.

All money and coins are fictional. See the [Terms of Service](./docs/TERMS.md) and [Privacy Policy](./docs/PRIVACY.md).

## Commands

### 💰 Economy

| Command | What it does |
|---|---|
| `/work` | Earn a random reward (100 to 1000). Per-user cooldown set by the server. |
| `/wallet_balance` | See your wallet. |
| `/bank_balance` | See your bank balance. |
| `/deposit` `amount` | Move money from wallet to bank. |
| `/withdraw` `amount` | Move money from bank to wallet. |
| `/transfer` `user` `amount` | Send bank money to another member. The server tax is taken from what they receive. |
| `/leaderboard` `[by]` | Top 10 richest members by total, wallet or bank, plus your rank. |
| `/economy_info` | Server symbol, cooldown, tax rate, interest rate and treasury. |

### 📈 Crypto (simulated)

| Command | What it does |
|---|---|
| `/crypto market` | Current prices and 24h change of every coin. |
| `/crypto chart` `coin` `[range]` | Price chart image for 1h, 24h, 7d or 30d. |
| `/crypto buy` `coin` `amount` | Spend wallet money on a coin. |
| `/crypto sell` `coin` `[quantity]` | Sell some or all of a coin; the server tax applies to the proceeds. |
| `/crypto portfolio` | Your coins, their value and what you paid. |

Coins: Purrcoin (PURR), Meowthereum (MEOW), Whisker Token (WSK), Catnip (NIP) and Tuna Stable (TUNA). Prices move every 5 minutes with a mean-reverting random walk, are the same in every server, and holdings are per server.

### 🎲 Games

| Command | What it does |
|---|---|
| `/coinflip` `choice` `[amount]` | Bet wallet money on heads or tails. |

### 🛠️ Admin (requires Administrator)

| Command | What it does |
|---|---|
| `/add_balance` | Add money to a member's wallet or bank. |
| `/set_cooldown_time` | `/work` cooldown in seconds. Active cooldowns longer than the new value are shortened. |
| `/set_economy_symbol` | Currency symbol (1 or 2 characters). |
| `/set_tax_rate` | Tax on transfers and crypto sales, 0 to 50%. Collected tax goes to the server treasury. |
| `/set_interest_rate` | Daily bank interest, 0 to 5% (default 0.1%). Each account earns at most 10,000 per day. |

### ℹ️ Utility

| Command | What it does |
|---|---|
| `/help` | Lists every command and the support, privacy and terms links. |
| `/ping` | Bot and API latency. |
| `/delete_my_data` `confirm` | Deletes your balances and coins in every server. |

### Developer

`/sync_slash_guild` is only registered in `GUILD_ID` and only works for `OWNER_ID`. It publishes the commands (same as `npm run deploy-commands`).

## Running it

### With Docker (recommended)

```bash
cp .env.example .env       # fill in TOKEN, CLIENT_ID, OWNER_ID, GUILD_ID
docker compose up -d --build
docker compose run --rm bot node dist/scripts/deploy_commands.js
```

`docker-compose.yml` starts the bot with its own PostgreSQL. To use Supabase or another hosted database instead, follow the comment at the top of that file. The container applies pending database migrations every time it starts, and shuts down cleanly on `docker compose down` or a redeploy.

The image runs on any Docker host (a VPS, Render, Railway, Fly.io...). The bot only needs outbound internet; it does not open any port.

### Without Docker

Requires Node.js 20+ and PostgreSQL 14+.

```bash
npm ci
cp .env.example .env       # fill it in, including DATABASE_URL
npm run build
npm run deploy-commands    # publish slash commands (once, and after adding or changing commands)
npm start                  # applies migrations, then starts the bot
```

### Publishing commands

`npm run deploy-commands` registers the public commands **globally**, so they work in every server that adds Purrfit, and registers developer commands only in `GUILD_ID`. Run it again whenever you add or change a command.

## Website (public frontend)

`src/web/` is the **public frontend** of the website: plain HTML, CSS and JavaScript (no framework, no build step) for the landing page, the login page, the dashboard and the legal pages. It is only a client: it calls an HTTP API and holds no server logic, queries or secrets.

The server that serves it and implements that API (Discord sign-in, sessions, dashboard data) is **not part of this repository**. It is a separate, private project. What this repository gives it:

- **Frontend files** in `src/web/` and the legal documents in `docs/` (the backend reads the `_Version:` line of each document, so **bump it whenever a document changes in a way users must re-accept**).
- **Bot heartbeat**: the bot writes its own health into the `bot_heartbeat` table every 30 s (`src/bot/services/heartbeat.ts`, migration `003`). A web server being up does not mean the bot is up; readers must use this heartbeat.
- **Market snapshot**: `npm run worker:market` publishes the simulated prices to `data/market.json` every 2 minutes, using the same function as `/crypto market` ([`src/shared/`](./src/shared)).

`src/shared/tests/frontend-boundary.test.ts` fails the build if server code, secrets, SQL, source maps or browser-side session storage ever end up in `src/web/`.

## Configuration

See [`.env.example`](./.env.example). Required: `TOKEN`, `CLIENT_ID`, `OWNER_ID`, `DATABASE_URL` (and `GUILD_ID` for the developer command).

Optional:

- `DATABASE_CA_CERT`: verifies the database SSL certificate (recommended for Supabase).
- `ERROR_WEBHOOK_URL`: a Discord webhook that receives error alerts (throttled to one every 10 seconds).
- `LOG_LEVEL`: `debug`, `info`, `warn` or `error`.
- `SUPPORT_URL`, `PRIVACY_URL`, `TERMS_URL`: links shown in `/help`.
- `MARKET_SNAPSHOT_PATH`: where the market worker writes the price snapshot (default `data/market.json`).
- `DISABLE_JOBS=true`: stops an instance from running background jobs.

## Database

The schema lives in [`migrations/`](./migrations) and is applied automatically by `npm start` (or `npm run migrate`). Applied files are tracked in `schema_migrations`, and an advisory lock prevents two instances from migrating at once. To change the schema, add a new numbered file such as `003_something.sql`; never edit one that already ran.

Background jobs (crypto price ticks every 5 minutes, bank interest once per UTC day) claim each run in the `scheduled_jobs` table, so running two instances at once never ticks or pays twice.

See [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) for the tables.

## Safety

- Every balance change runs in a transaction with row locks, so parallel commands cannot double-spend (covered by integration tests).
- Users are rate-limited (a shared token bucket plus per-command cooldowns, e.g. 3 s for `/coinflip`).
- Admin commands are hidden from non-admins and checked again at runtime.

## Development

```bash
npm run typecheck
npm run lint
npm test                                   # unit tests
TEST_DATABASE_URL=postgres://... npm test  # also runs the Postgres integration tests (wipes the tables!)
```

GitHub Actions runs type checking, lint, formatting, all tests against a Postgres service, and a Docker build on every push and pull request.

## Project structure

```text
migrations/               SQL migrations
src/
  scripts/                migrate.ts, deploy_commands.ts
  bot/
    index.ts              Discord client, interaction router, rate limit, shutdown
    syncer.ts             command registry (public and developer commands)
    commands/             slash commands
    Helpers/              embeds, validators
    services/
      database/           pool, transactions, repositories (clients, crypto, servers, jobs)
      economy/            pure rules: taxes, interest, price simulation
      charts/             price chart rendering
      jobs/               background scheduler
      logger.ts, rate_limit.ts
    tests/                unit tests and tests/integration (Postgres)
  shared/                 what the bot publishes for other services (market worker, snapshot)
  web/                    public frontend only (index, login, dashboard, legal; css/, js/)
docs/                     Privacy Policy and Terms of Service
```

## Changelog

See [CHANGELOG.md](./CHANGELOG.md).
