# Purrfit

Purrfit is a Discord economy bot built with TypeScript, `discord.js` v14 and PostgreSQL.
Every server gets its own economy: members work for money, save it in the bank (which pays daily interest), send it to each other, gamble it on a coinflip and trade simulated cryptocurrencies with live price charts. Admins set the rules: command prefix, currency symbol, work cooldown, taxes and interest, from chat or from the web dashboard.

All money and coins are fictional. See the [Terms of Service](./docs/TERMS.md) and [Privacy Policy](./docs/PRIVACY.md).

## Commands

Commands are typed in chat with the server's **prefix**, `$>` by default (`$>work`). Admins can change it with `$>prefix <new>` or from the dashboard; mentioning the bot (`@Purrfit`) tells you the current one. Most commands also have short aliases (shown below): `$>w` is `$>work`. Only `/help`, `/dashboard` and `/support` are slash commands. Arguments in `<angle brackets>` are required and `[square brackets]` are optional; amounts accept `1,000`, `1k`, `2.5m` and `1b`.

Errors and cooldown notices are answered in the channel and the bot deletes them a few seconds later.

### 💰 Economy

| Command | Aliases | What it does |
|---|---|---|
| `$>work` | `w` | Earn a random reward (100 to 1000). Per-user cooldown set by the server. |
| `$>wallet_balance` | `wallet`, `bal`, `balance` | See your wallet. |
| `$>bank_balance` | `bank`, `bb` | See your bank balance. |
| `$>deposit <amount>` | `dep`, `d` | Move money from wallet to bank. |
| `$>withdraw <amount>` | `with`, `wd` | Move money from bank to wallet. |
| `$>transfer <user> <amount>` | `pay`, `send` | Send bank money to another member. The server tax is taken from what they receive. |
| `$>leaderboard [by]` | `lb`, `top` | Top 10 richest members by total, wallet or bank, plus your rank. |
| `$>economy_info` | `eco`, `info` | Server symbol, cooldown, tax rate, interest rate and treasury. |

### 📈 Crypto (simulated)

| Command | Aliases | What it does |
|---|---|---|
| `$>crypto market` | `c m` | Current prices and 24h change of every coin. |
| `$>crypto chart <coin> [range]` | `c ch` | Price chart image for 1h, 24h, 7d or 30d. |
| `$>crypto buy <coin> <amount>` | `c b` | Spend wallet money on a coin. |
| `$>crypto sell <coin> [quantity]` | `c s` | Sell some or all of a coin; the server tax applies to the proceeds. |
| `$>crypto portfolio` | `c pf`, `c port` | Your coins, their value and what you paid. |

Coins: Purrcoin (PURR), Meowthereum (MEOW), Whisker Token (WSK), Catnip (NIP) and Tuna Stable (TUNA). Prices move every 5 minutes with a mean-reverting random walk, are the same in every server, and holdings are per server. The dashboard shows them as candlestick charts.

### 🎲 Games

| Command | Aliases | What it does |
|---|---|---|
| `$>coinflip <heads\|tails> [amount]` | `cf`, `flip` | Bet wallet money on heads or tails. |

### 🛠️ Admin (requires Administrator)

| Command | Aliases | What it does |
|---|---|---|
| `$>add_balance <user> <wallet\|bank> <amount>` | `addbal` | Add money to a member's wallet or bank. |
| `$>set_cooldown_time <seconds>` | `setcd` | `work` cooldown. Active cooldowns longer than the new value are shortened. |
| `$>set_economy_symbol <symbol>` | `setsymbol` | Currency symbol (1 or 2 characters). |
| `$>set_tax_rate <percent>` | `settax` | Tax on transfers and crypto sales, 0 to 50%. Collected tax goes to the server treasury. |
| `$>set_interest_rate <percent>` | `setinterest` | Daily bank interest, 0 to 5% (default 0.1%). Each account earns at most 10,000 per day. |

All of these can also be changed from the dashboard.

### ℹ️ Utility

| Command | Aliases | What it does |
|---|---|---|
| `$>prefix [new_prefix]` | `setprefix` | See the prefix; admins can change it (1 to 5 characters, `reset` restores `$>`). |
| `$>ping` | | Bot and API latency. |
| `$>delete_my_data confirm` | `deletedata` | Deletes your balances and coins in every server. |
| `/help` | | Lists every command with this server's prefix, and the support, privacy and terms links. |
| `/dashboard` | | Link to the web dashboard. |
| `/support` | | Link to the support server. |

### Developer

`$>sync` only works for `OWNER_ID`. It publishes the slash commands (same as `npm run deploy-commands`).

The command list lives in [`src/bot/syncer.ts`](./src/bot/syncer.ts), and how to write one is in [`src/bot/framework/README.md`](./src/bot/framework/README.md).

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
npm run deploy-commands    # publish /help, /dashboard and /support (once)
npm start                  # applies migrations, then starts the bot
```

### Discord Developer Portal

Commands are read from chat, so the bot needs the **Message Content** intent: Developer Portal > your application > **Bot** > *Privileged Gateway Intents* > enable **Message Content Intent**. Without it the bot starts but cannot see any command. A bot in 100 or more servers needs Discord to verify it and approve this intent first.

### Publishing slash commands

Only `/help`, `/dashboard` and `/support` are slash commands. `npm run deploy-commands` (or `$>sync` from the owner account) publishes them **globally** and removes every slash command of earlier versions. If `GUILD_ID` is set it also empties that server's old slash list. Prefix commands need no deployment. Run it once, and again only when those three change.

## Website (public frontend)

`src/web/` is the **public frontend** of the website: plain HTML, CSS and JavaScript (no framework, no build step) for the landing page, the login page, the dashboard and the legal pages. It is only a client: it calls an HTTP API and holds no server logic, queries or secrets.

The server that serves it and implements that API (Discord sign-in, sessions, dashboard data) is **not part of this repository**. It is a separate, private project. What this repository gives it:

- **Frontend files** in `src/web/` and the legal documents in `docs/` (the backend reads the `_Version:` line of each document, so **bump it whenever a document changes in a way users must re-accept**).
- **Bot heartbeat**: the bot writes its own health into the `bot_heartbeat` table every 30 s (`src/bot/services/heartbeat.ts`, migration `003`). A web server being up does not mean the bot is up; readers must use this heartbeat.
- **Market snapshot**: `npm run worker:market` publishes the simulated prices to `data/market.json` every 2 minutes, using the same function as `$>crypto market` ([`src/shared/`](./src/shared)).
- **Server list**: the bot keeps the `bot_guilds` table (migration `005`) with the servers it is in, so the dashboard knows where Purrfit is without needing the bot token.
- **Per-server prefix**: `server_configurations.prefix` (migration `004`). The dashboard and `$>prefix` write the same column; the bot caches it for up to a minute.
- **Command list**: `npm run export-commands` writes `data/commands.json` (names, aliases, usage, permission) for the dashboard's command reference. Run it after changing commands.

The dashboard has three sections: **servers** (choose a server and change its prefix, symbol, cooldown, tax and interest), **commands** and **markets** (candlestick charts of the simulated coins, drawn with [TradingView Lightweight Charts](https://github.com/tradingview/lightweight-charts), see [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)).

`src/shared/tests/frontend-boundary.test.ts` fails the build if server code, secrets, SQL, source maps or browser-side session storage ever end up in `src/web/`.

## Configuration

See [`.env.example`](./.env.example). Required: `TOKEN`, `CLIENT_ID`, `OWNER_ID`, `DATABASE_URL`. `GUILD_ID` is optional: with it, `deploy-commands` also clears that server's old slash commands.

Optional:

- `DATABASE_CA_CERT`: verifies the database SSL certificate (recommended for Supabase).
- `ERROR_WEBHOOK_URL`: a Discord webhook that receives error alerts (throttled to one every 10 seconds).
- `LOG_LEVEL`: `debug`, `info`, `warn` or `error`.
- `SUPPORT_URL`, `PRIVACY_URL`, `TERMS_URL`: links shown in `/help` (`SUPPORT_URL` is also the `/support` button).
- `DASHBOARD_URL`: public address of the web dashboard, opened by `/dashboard` and linked in `/help`.
- `COMMANDS_MANIFEST_PATH`: where `npm run export-commands` writes the command list the dashboard shows (default `data/commands.json`).
- `MARKET_SNAPSHOT_PATH`: where the market worker writes the price snapshot (default `data/market.json`).
- `DISABLE_JOBS=true`: stops an instance from running background jobs.
- `HEARTBEAT_LOG=true`: also prints the heartbeat (gateway ping, servers, users, RAM) to the log every 30 s. Off by default; the local monitor turns it on by itself.

## Database

The schema lives in [`migrations/`](./migrations) and is applied automatically by `npm start` (or `npm run migrate`). Applied files are tracked in `schema_migrations`, and an advisory lock prevents two instances from migrating at once. To change the schema, add a new numbered file such as `003_something.sql`; never edit one that already ran.

Background jobs (crypto price ticks every 5 minutes, bank interest once per UTC day) claim each run in the `scheduled_jobs` table, so running two instances at once never ticks or pays twice.

See [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) for the tables.

## Safety

- Every balance change runs in a transaction with row locks, so parallel commands cannot double-spend (covered by integration tests).
- Users are rate-limited (a shared token bucket plus per-command cooldowns, e.g. 3 s for `$>coinflip`).
- Admin commands are checked by the command dispatcher before they run, and the web dashboard only lets a user change servers where they are the owner or an Administrator.
- The bot reads message text only to check for the prefix; other messages are discarded and nothing typed is stored (see the Privacy Policy).

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
  scripts/                migrate.ts, deploy_commands.ts, export_commands.ts
  bot/
    index.ts              Discord client, message and slash routers, rate limit, shutdown
    syncer.ts             command registry (prefix commands by category, and the three slash commands)
    framework/            prefix command engine: dispatcher, argument parser, registry (see its README)
    commands/             the commands (prefix commands, plus the three slash ones in utils/)
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
