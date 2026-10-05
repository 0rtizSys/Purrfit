# Changelog

## [Unreleased]
Website frontend, bot heartbeat and versioned legal documents. The website's server is a separate, private project.

### ✨ Added
- `src/web/`: public frontend in vanilla HTML/CSS/JS (gold, money green and black, official PFP in `assets/images/purrfit_pfp.jpg`): landing page (presentation, filterable commands, invite steps, contact), **login page** ("Continue with Discord" plus terms/privacy acceptance), **dashboard** (bot status, account, session and account-deletion actions) and legal pages that render `docs/*.md`. Custom inline SVG icons; animations respect `prefers-reduced-motion`. No inline scripts or styles, no `localStorage`/`sessionStorage`: it works under a strict Content-Security-Policy and keeps all security decisions on the server.
- **Bot heartbeat**: migration `003_bot_heartbeat.sql` adds `bot_heartbeat`, and `src/bot/services/heartbeat.ts` writes one row per process every 30 s (Discord readiness, latency, guilds, approximate users, version, memory, last event) and marks itself `stopping` on shutdown. A failed write is logged (throttled) and never affects the bot.
- `src/shared/`: `market_worker.ts` (`npm run worker:market`, `worker:market:dev`) publishes the simulated prices to `data/market.json` every 2 minutes using `listMarket()`; `market_snapshot.ts` with tests.
- `src/shared/tests/frontend-boundary.test.ts`: fails if server code, secrets, SQL, source maps, inline scripts or browser-side session storage appear in `src/web/`.
- Unit tests for the heartbeat.

### ♻ changes
- **Terms of Service and Privacy Policy 2.0**: now cover the website (Discord sign-in with the `identify` scope only, session and sign-in cookies, stored data, logs, retention, third parties, deleting the web account) and carry a `_Version:` line that the website backend records as the version a user accepted.
- `.gitignore` ignores `data/`, source maps and server directories, so backend code cannot be committed here by accident.

### 🔒 Security
- The website's server code is **not** in this repository (it is public). An earlier local draft of `src/web/server.js` and `src/shared/invite.config.json` was removed before it was ever pushed.

## [2.1.0] - 2026-10-05
UI/UX overhaul: one visual system for every embed.

### ✨ Added
- `src/bot/ui/theme.ts`: tone palette (`brand` gold `#F1C40F`, `success` `#2ECC71`, `error` `#E74C3C`, `cooldown` `#5DADE2`, `crypto` `#9B59B6`, `admin` `#5865F2`, defined in `configs/embed_configs.json`) and a shared `Emoji` vocabulary.
- `src/bot/ui/format.ts`: `formatNumber`, `money`/`moneyText` (thousands separators, no space after the symbol), `signedMoney`, `moneyChange` (`` `$100` → `$350` ``), `formatDuration` (`1m 30s`), `relativeTime` (Discord `<t:…:R>`), `formatChange`, `headline` (`###` markdown).
- `Helpers/balance_embed.ts`: `/wallet_balance` and `/bank_balance` show the requested balance as a headline plus the other balance and the total.
- `sendErrorEmbed(interaction, title, description, hint?)` and `buildEmbed`.
- `/help` renders clickable command mentions (`</name:id>`, ids fetched once per process, falls back to `/name`) and lists each `/crypto` subcommand.
- `/work` flavor lines and a "Next shift" relative time.

### ♻ changes
- `SimpleEmbedOptions`: `thumType` replaced by `tone`; new `author`, `hint` (`-# 💡` subtext line), `timestamp`, `thumbnail`, `image`, `files`, `color`. Non-error embeds get a "Purrfit" footer with the bot avatar; transactions get a timestamp; the imgur success/error thumbnails were removed.
- `sendSimpleEmbed`: `tone: "error"` is always ephemeral; an error or `eph` message after a **public** defer deletes the deferred reply and sends a private follow-up instead of showing it to the channel.
- Every error has a specific title and a fix hint (`InsuficientsFundsEmbed` shows balance, needed amount and shortfall; `SameUserEmbed`, `botTargetEmbed`, `notEnoughPermsEmbed`, `amountErrorEmbed`, `requireGuild`).
- `/transfer` validates self/bot/amount before deferring, so those errors are always private; success shows From/To and tax/received.
- `/coinflip` uses the shared insufficient-funds embed; a lost bet is red but public with footer.
- `/crypto`: market, chart (embed color follows the trend), buy, sell and portfolio (profit vs. cost per coin) use the new layout; `crypto.ts` no longer builds its own `EmbedBuilder`.
- Admin commands (`/set_cooldown_time`, `/set_economy_symbol`, `/set_tax_rate`, `/set_interest_rate`, `/add_balance`) use the `admin` tone with `old → new` and the acting admin as author; `/add_balance` shows the new balance.
- `/economy_info` and `/leaderboard` show the server icon; the leaderboard highlights the caller's line.
- Router: the rate-limit reply and the fallback error are embeds (the Spanish "Error ejecutando comando" text is gone); `/sync_slash_guild` replies in English embeds.
- `visibility` is optional (default private) on `/wallet_balance` and `/bank_balance`; command and option descriptions were capitalized and reworded.
- `/ping` defers instead of sending a placeholder text message.

### 🐛 Logic bugs fixed
- `/bank_balance` read the economy symbol before deferring, so a slow query could expire the interaction.
- Typos in user-facing text ("successfully deposit", "dont", "comand").

### 🧪 Tests
- `ui-format.test.ts`: money/duration/timestamp formatting, tone color, footer and hint, ephemeral errors, private follow-up after a public defer.
- `deposit-withdraw.test.ts` updated for the new titles.

## [2.0.0] - 2026-10-05
Public release preparation: global commands, Docker, migrations, advanced economy.

### ✨ Added
- Simulated crypto market: `/crypto market`, `/crypto chart` (PNG chart rendered with `@napi-rs/canvas`, ranges 1h/24h/7d/30d), `/crypto buy`, `/crypto sell`, `/crypto portfolio`. Five coins (PURR, MEOW, WSK, NIP, TUNA) seeded in `migrations/002_advanced_economy.sql`. Prices follow a mean-reverting log random walk (`services/economy/market_sim.ts`), tick every 5 minutes, are bounded to 2%–5000% of the base price and keep 35 days of history; a fresh install backfills 7 days so charts are never empty.
- Daily bank interest (`runBankInterest`, default 10 bps, max 500 bps, capped at 10,000 per account per day) paid once per UTC day.
- Server taxes (`tax_bps`, 0–5000) on `/transfer` (taken from the received amount) and crypto sales; collected tax goes to `server_configurations.treasury`.
- `/set_tax_rate`, `/set_interest_rate` (Administrator), `/economy_info`, `/leaderboard` (total/wallet/bank + caller rank), `/help` (built from the registry, with `SUPPORT_URL`/`PRIVACY_URL`/`TERMS_URL` links), `/delete_my_data` (deletes balances and holdings in every server; active `/work` cooldowns are kept so it cannot be used to skip them).
- SQL migrations in `migrations/` with runner `src/scripts/migrate.ts` (`schema_migrations` table, `pg_advisory_lock`, one transaction per file); `npm start` migrates before starting.
- `src/scripts/deploy_commands.ts` / `npm run deploy-commands` and `services/discord/deploy_commands.ts`.
- `Dockerfile` (multi-stage, `node:22-bookworm-slim`, non-root, fonts for charts), `.dockerignore`, `docker-compose.yml` (bot + Postgres 16, slot reserved for the future website).
- `services/logger.ts`: timestamped levelled logs (`LOG_LEVEL`) and error alerts to `ERROR_WEBHOOK_URL` (throttled, no mentions).
- `services/rate_limit.ts`: per-user token bucket (6 burst, 1 every 2 s) and per-command cooldowns (`coinflip`/`transfer` 3 s, `crypto` 2 s, `leaderboard` 5 s, `delete_my_data` 10 s), applied in the router.
- `services/jobs/scheduler.ts`: runs the price tick and interest jobs; each run is claimed in `scheduled_jobs` under a row lock so multiple instances never double-run. `DISABLE_JOBS=true` turns them off for an instance.
- `docs/PRIVACY.md` and `docs/TERMS.md`.
- GitHub Actions CI (`.github/workflows/ci.yml`): typecheck, lint, prettier, unit + Postgres integration tests, build, Docker build.
- `DATABASE_SSL=disable` for local databases; new variables documented in `.env.example`.

### ♻ changes
- Public commands are registered **globally**; developer commands (`sync_slash_guild`) only in `GUILD_ID`. The old `sync_slash.ts` script that deleted all global commands was removed.
- `syncer.ts` exports `commandCategories`, `publicCmds`, `devCmds` and `cmds`.
- `transferSafe` returns `{ ok: true, received, tax }`.
- `index.ts`: graceful shutdown on `SIGTERM`/`SIGINT` (stops jobs, `client.destroy()`, `pool.end()`, 10 s hard limit), `GuildCreate`/`GuildDelete` logging, exits with an error when `TOKEN` is missing or login fails, presence changed to "Watching the crypto markets", dropped the unused `GuildMessages` intent.
- All command and database errors go through `logger` instead of `console`.
- `dotenv.config({ quiet: true })` everywhere.
- `InsuficientsFundsEmbed` accepts `"spend"`.
- `package.json`: version `2.0.0`, scripts `build`, `start`, `migrate`, `deploy-commands`, `lint`, `typecheck`, `test:integration`; `tsconfig.build.json` excludes tests from `dist`; Jest maps `.js` import suffixes.

### 🔒 Security
- Removed unused `express`, `cors`, `ts-node-dev` (and their types); ran `npm audit fix`. `npm audit` reports 0 vulnerabilities.

### 🧪 Tests
- `tests/integration/economy.int.test.ts` (runs when `TEST_DATABASE_URL` is set): idempotent migrations, buy/sell with tax and treasury, insufficient funds/oversell, 8 parallel buys and 6 parallel sells cannot overdraw, transfer tax, interest once per day with cap, market tick claim and backfill, leaderboard rank, data deletion keeping active cooldowns.
- `rate-limit.test.ts`, `economy-policy.test.ts` (tax, bps, price simulation bounds, chart PNG), `command-registry.test.ts` (unique names, dev commands never global, valid payloads), transfer tax case in `money-repository.test.ts`.

## [1.11.0] - 2026-10-05
- Added `DATABASE_CA_CERT` and `DB_POOL_MAX` to `.env.example`

### 🔒 Security
- Fixed `/set_economy_symbol` saving the new symbol for members without `Administrator` (missing `return` after `notEnoughPermsEmbed` in `set_eco_symbol.admin.ts`).
- Fixed `/add_balance` continuing after the permission error; it was only stopped by the `deferReply` exception on an already-replied interaction. Permission checks now run first in both commands.
- Added `setDefaultMemberPermissions(Administrator)` to `add_balance`, `set_cooldown_time` and `set_economy_symbol` so they are hidden from non-admins (runtime checks kept).
- Fixed `/work` race condition (check cooldown -> pay -> set cooldown) that paid out once per parallel call (25 parallel calls paid 25x in a local reproduction). New `claimCooldown` in `cd_manager.ts` uses `INSERT ... ON CONFLICT DO UPDATE ... WHERE cooldown <= now` and `claimWorkReward` (`repository/clients/work.ts`) claims the cooldown and pays in one transaction.
- `/set_economy_symbol` rejects markdown and mention characters (`` ` * _ ~ | \ < > @ ``) and counts length in code points.
- `db.ts` verifies the server certificate when `DATABASE_CA_CERT` is set (previously always `rejectUnauthorized: false`).
- Added Discord-side bounds (`setMinValue`/`setMaxValue`/`setMaxLength`) to every amount option, `set_cooldown_time` (1 to 2,592,000 s, also enforced in `setCdTime`) and the symbol option.
- `validateAmount` schema now requires integers (`z.number().int()`).

### ♻️ changes
- Added `withTransaction` helper (`services/database/transaction.ts`): `BEGIN`/`COMMIT`/`ROLLBACK`, always releases the client and destroys it if `ROLLBACK` fails. Used by `transferSafe`, `transferInternalSafe`, `applyWalletWager` and `claimWorkReward`.
- `transferSafe` and `transferInternalSafe` now return a typed result (`{ ok: true }` or `{ ok: false, reason: "insufficient_funds", currentBalance }`) and throw on database errors instead of returning `true`.
- `transferSafe` creates both rows and locks them `ORDER BY user_id FOR UPDATE`, so crossed A->B / B->A transfers no longer deadlock; the debit and credit are a single `UPDATE`.
- `/deposit`, `/withdraw` and `/transfer` defer the reply before any database query and no longer pre-check the balance outside the transaction (removed `hasInsufficientBalance`); the insufficient-funds embed uses the balance read under the row lock. Saves 2 round-trips per command and avoids expired interactions on a slow database.
- `getBalance` is a single read-only `SELECT` (returns `0` for unknown users instead of inserting a row) and returns `number`.
- `getEcoSymbol` and `getCdTime` are cached per guild for 60 s (`services/cache/ttl_cache.ts`); `setEcoSymbol` and `setCdTime` update the cache.
- `/work` reads cooldown time and symbol in parallel and uses `crypto.randomInt` for the reward.
- `isBotAction` uses the `User` already resolved in the interaction instead of `client.users.fetch`.
- `pg` pool: added `error` listener, `max` (`DB_POOL_MAX`, default 10), `idleTimeoutMillis` and `connectionTimeoutMillis`.
- `index.ts`: the error reply is wrapped in `try/catch`, and added `Events.Error` and `unhandledRejection` handlers so a failed Discord reply cannot crash the bot.

### 🐛 Logic bugs fixed
- Fixed `removeBalance` inserting a row with a positive balance for unknown users and throwing when funds were insufficient; it now returns `null`.
- Fixed `sendSimpleEmbed` not awaiting `interaction.reply` (unhandled rejection).
- Fixed `/set_economy_symbol` showing success when `setEcoSymbol` failed.
- Fixed `/deposit` amount option description saying "Amount to withdraw".

### 🧪 Tests
- Fixed stale mock paths in `deposit-withdraw.test.ts` and `scdt.test.ts` (`tables/` -> `repository/`, `../../db`) and the Spanish expectations in `coin-flip.test.ts`; all suites pass.
- Added `money-repository.test.ts` (work cooldown claim, transfer lock order, insufficient funds, rollback, column allowlist, `removeBalance`).
- Added `admin-permissions.test.ts` (non-admins cannot run `add_balance` / `set_economy_symbol`).

## [1.10.2] - 2026-08-13
- Updated `README.md`

### ♻️ changes
- Documented `/set_cooldown_time` cooldown-shortening behavior for active `/work` cooldowns.
- Changed `setCdTime` to handle database client acquisition failures through the same error return path.

### 🧪 Tests
- Added `scdt.test.ts` with unit tests for `setCdTime` validation, successful transaction flow, rollback behavior, and connection failures.

### 🐛 Logic bugs fixed
- Fixed `setCdTime` leaking PostgreSQL connection errors instead of returning `true`.

## [1.10.1] - 2026-06-30
- Added `DATABASE_URL` on `env.example` to connect your database to Supabase

### ♻️ changes
- Changed PostgreSQL connection to use a Supabase connection string in `src/bot/services/database/db.ts`
- Changed `coinflip` game language to `EN`

## [1.10.0] - 2026-06-30
- Added `LICENCE`

## [1.9.0] - 2026-05-14
- Added `coinflip.ts`

## [1.8.0] - 2026-05-14
- Added `deposit.ts`
- Added `action` parameter to `hasInsufficientBalance()` with values `deposit`, `withdraw` and `transfer` on `validator.ts:40`

### ♻️ changes
- Changed parameter `type` where `transfer` & `withdraw` to `checkBank` & `checkWallet` on `validator.ts:39`
- Updated `README.md`
- Added `jest` and `ts-jest` as dev dependencies for testing
- Added `validateAmount` pure function extracted from `isInvalidAmount`

### 🧪 Tests
- Added `validator.test.ts` with unit tests for `validateAmount`
- Added `deposit-withdraw.test.ts` with unit tests for `depositCommand` & `withdrawCommand`

### 🐛 Logic bugs fixed
- Fixed bug on `deposit.ts` & `withdraw.ts` where if the transaction went wrong it returns a success embed

### 🔧 Fixes & Refactors
- Improved `CHANGELOG.md` consistency by adding missing emojis to section headers and `---` separators between versions

---

## [1.7.3] - 2026-05-14
### 🐛 Logic bugs fixed
- Fixed `/transfer` returning `Transaction went wrong` unexpectedly

---

## [1.7.2] - 2026-05-14

### ♻️ changes
- Changed `addNumberOption` to `addIntegerOption` in `withdraw.ts:26`
- Deleted intent `MessageContent` on `index.ts`

### 🔒 Security vulnerabilities fixed
- Added permission validator on `set_eco_symbol.ts`
- Added atomic transactions to `withdraw` via `withdraw-transfer.ts` and `transferInternalSafe`


### 🐛 Logic bugs fixed
- Added `await` to `work.ts:44`
- Added `await` to `withdraw.ts:37`
- Added `await` to `add_balance.ts:51`
- Added `return` in if statement `set_cd_time.admin.ts:32`
- Added `await` on all else statements on `simplified_embed_builder.ts`
- Added `isBotAction()` function to `transfer.ts:55`
- Fixed `setCdTime` not propagating database errors to caller

---

## [1.7.1] - 2026-05-13
- Updated `README.md`
- Added `DATABASE_SCHEMA.md`
- Added `env.example`

---

## [1.7.0] - 2026-05-13
- Added `withdraw.ts`
- Added new parameter `type` with options `transfer / withdraw` on `hasInsufficientBalance()` function

### ♻️ Changes 
- Renamed `hasEnoughBalance()` function to `hasInsufficientBalance()`
- Renamed `addBalanceBW()` function to `addBalance()`
- Renamed `getBalanceBW()` function to `getBalance()`
- Updated `CHANGELOG.md` formatting and date corrections
- Fixed `1.6.0` release date from `2026-05-25` to `2026-04-25`
- Fixed typo `Know bugs` → `Known Bugs` in `1.4.0 & 1.5.0`

---

## [1.6.0] - 2026-04-25
- Added `transfer.ts` command
- Added `transaction.ts` in `bot/services/tables/clients` dedicated to the command `transfer.ts`

---

## [1.5.3] - 2026-04-20
- Improved `wallet.ts` User Interface 

### ♻️ Changes
- Updated all `tables/servers/` elements dependency paths

---

## [1.5.2] - 2026-04-20
- Added `bank` & `wallet` support in `clients/manager.ts` functions
- Moved elements of `servers/configs` to `servers/` and updated elements path

---

## [1.5.1] - 2026-04-20

### 🔧 Fixes & Refactors
- Resolved circular dependency in `sync_slash.ts` and refactored the sync logic for better runtime stability.
- Updated `package.json` entry point and fixed the directory mismatch between source files and the compiled `dist/` layout.
- Added optional chaining (`?`) to `bank.ts` command descriptions to prevent "undefined" crashes during registration.

---

## [1.4.0 & 1.5.0] - 2026-04-20
- Added `bank_balance` for members to view their bank balance

### ♻️ Changes
- Changed param names in `manager.ts`
- Changed variable `visible` to `isPublic` in `wallet.ts`
- Removed unused `const result =` in `set_cd_time.ts` and `set_eco_symbol.ts`

### 🐞 Known bugs
- `bank.ts` isnt syncing correctly somehow but its correctly exported

---

## [1.2.0] - 2026-04-19
- Added `set_economy_symbol` so admins can change the economy icon

### ♻️ Changes

- Translated `CHANGELOG.md` From Spanish to English
- Refactored function names and types

### 🗑️ Removed

- All `dashboard/` folder
- All `backend/` folder

---

## [1.1.2] - 2026-04-18
- Fixed inconsistencies in embed thumbnail width and height
- Removed new image text from thumbnails

---

## [1.1.1] - 2026-04-17
- Optimized user-admin permission validation
- Added `success_icon.png` file

---

## [1.1.0] - 2026-04-17
- Added `set_cooldown_time` so admins can manage the cooldown time for the `work` command

### 🩹 Patches
- Added `['seconds']` to the `work` command cooldown alert

### ♻️ Changes
- Renamed `setCooldown` and `getCooldown` to snake_case
- Removed `s_stacker.ts` — wasn't pulling its weight
- Removed `s_manager.ts` — same deal
- Cleaned up leftover `console.log()` calls from `cd_manager.ts` and `work`

---

## [1.0.1] - 2026-04-17
- Fixed a bug in the `work` command where the cooldown was showing milliseconds instead of seconds
- Improved time system handling and consistency

### 📊 Status
- `work` command is now more stable and consistent
- Cooldown system is more reliable and easier to maintain

---

## [1.0.0] - 2026-04-17
- Added `/work` so users can earn money in a simple way
- Added `/wallet_balance` to check wallet balance publicly or privately
- Added `/add_balance` so admins can grant balance to users
- Added support for sending balance to wallet or bank from the admin side
- Added a cooldown to `/work` to prevent spam
- Set up per-server config reading (cooldown, economy symbol) — groundwork is laid
- Added `/ping` to quickly check if the bot is alive
- Added internal slash command sync to make testing and deploys easier

### 📊 Status
The economy foundation is up and running, but some things are still half-baked — internal support for settings and bank exists, though not everything has user-facing commands ye
