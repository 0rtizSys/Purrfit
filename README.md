# Purrfit

Purrfit is a Discord economy bot built with TypeScript, `discord.js`, and PostgreSQL.
It is designed around a simple server-based economy: users can work for money, check their wallet, and administrators can manage balances and server economy settings.

## Current Features

- Slash-command based interaction flow.
- Per-server economy data.
- Persistent wallet and bank balances stored in PostgreSQL.
- Per-user cooldown system for the `/work` command.
- Server configuration for:
  - economy symbol
  - work cooldown time
- Transactional server cooldown updates that shorten active `/work` cooldowns only when they exceed the new configured time.
- Shared embed helpers for consistent bot responses.
- Internal slash command sync command for development and deployment (guild-only).

## Commands

### Public Commands

- `/ping`
  - Shows bot latency and API latency.

- `/work`
  - Grants a random wallet reward between `100` and `1000`.
  - Uses a per-user cooldown stored in the database.
  - Optional `visibility` boolean controls whether the response is public or ephemeral.

- `/wallet_balance`
  - Shows the user's current wallet balance.

- `/bank_balance`
  - Shows the user's current bank balance.

- `/withdraw`
  - Withdraws an amount from `bank` into `wallet`.
  - Options:
    - `amount`
    - `visibility` (optional)

- `/deposit`
  - Deposits an amount from `wallet` into `bank`.
  - Options:
    - `amount`
    - `visibility` (optional)

- `/transfer`
  - Transfers `bank` balance to another user (ACID transaction).
  - Options:
    - `user`
    - `amount`
    - `visibility` (optional)

### Moderator / Admin Commands

- `/add_balance`
  - Adds money to either a user's `wallet` or `bank`.
  - Options:
    - `method`: `wallet` or `bank`
    - `amount`
    - `user`
    - `visibility`
  - Requires Administrator permission.

- `/set_cooldown_time`
  - Changes the cooldown time used by `/work`.
  - Value is set in positive integer seconds.
  - Existing active cooldowns longer than the new value are shortened for that server.
  - Requires Administrator permission.

- `/set_economy_symbol`
  - Changes the economy symbol used in that server.
  - Symbol length is limited to 1 or 2 characters.
  - Requires Administrator permission.

### Developer Command

- `/sync_slash_guild`
  - Syncs slash commands to the configured guild (and clears duplicates there).
  - Restricted to `OWNER_ID`.
  - Uses:
    - `CLIENT_ID`
    - `GUILD_ID`
    - `TOKEN`

## Environment Variables

The project expects these environment variables in `.env`:

```env
TOKEN=
OWNER_ID=
CLIENT_ID=
GUILD_ID=

DB_HOST=
DB_PORT=
DB_USER=
DB_PASSWORD=
DB_NAME=
```

## Database Expectations

The bot connects to PostgreSQL through `pg` and expects the following tables to already exist.
See `DATABASE_SCHEMA.md` to gather information about the tables the program expects

### `clients`

Used to store user balances per guild.

Expected columns:

- `user_id`
- `guild_id`
- `wallet`
- `bank`

Expected constraint:

- unique or primary key on `(user_id, guild_id)`

### `cooldowns_table`

Used to store work cooldown expiration timestamps.

Expected columns:

- `guild_id`
- `user_id`
- `cooldown`

Expected constraint:

- unique or primary key on `(guild_id, user_id)`

### `server_configurations`

Used to store per-server economy settings.

Expected columns:

- `guild_id`
- `cooldown_time`
- `economy_symbol`

Expected constraint:

- unique or primary key on `guild_id`

## Quick Start

1. Install dependencies:
   - `npm install`
2. Create and fill `.env` (see variables above).
3. Create the database tables (see `DATABASE_SCHEMA.md`).
4. Build & run:
   - `npm run compile`

## Project Structure

```text
src/
  bot/
    commands/
      dev/
      economy/
        admin/
        moderators/
        public/
      utils/
    configs/
    Helpers/
    services/
      database/
        repository/
          servers/
            set_cd_time.ts
            scdt.test.ts
        tables/
    index.ts
    syncer.ts
```

### Structure Notes

- `index.ts` boots the Discord client and routes interactions.
- `syncer.ts` works as the command registry.
- `commands/` contains slash command definitions and interaction handlers.
- `services/database/` contains PostgreSQL access logic.
- `Helpers/` contains reusable interaction utilities.
- `configs/` contains embed-related configuration.

## How It Works

- The bot loads environment variables with `dotenv`.
- It initializes a Discord client in `src/bot/index.ts`.
- Every slash command is registered in `src/bot/syncer.ts`.
- On interaction:
  - the bot looks up the command by name
  - executes the matching handler
  - falls back to a generic error response if execution fails

Economy behavior is scoped by guild:

- balances are stored per user and per guild
- cooldowns are stored per user and per guild
- economy symbol and cooldown time are stored per guild
- cooldown time changes run in a database transaction and roll back on failure

## Scripts

Current `package.json` scripts:

```json
{
  "dev": "tsc --watch",
  "compile": "npx tsc && node dist/bot/index.js"
}
```

Notes:

- `dev` watches TypeScript compilation only (it does not run the bot).
- `compile` builds TypeScript and runs the compiled entrypoint.

## Tech Stack

- TypeScript
- Node.js
- discord.js v14
- PostgreSQL
- dotenv
- Jest
- Prettier
- zod

## Current Limitations

- No migration or schema bootstrap files are included.
- Automated test coverage is still incremental.
- Some command validations and permission checks could still be tightened in code.

## Changelog

Recent documented additions include:

- configurable economy symbol
- configurable work cooldown
- embed and cooldown fixes
- command and naming refactors

See [CHANGELOG.md](./CHANGELOG.md) for the full history.

## Summary

Purrfit is already a functional foundation for a Discord economy bot with per-server configuration and persistent balances.
It is still an early-stage project, but the current codebase already supports a practical economy loop, admin controls, and a database-backed command system that can be extended further.
