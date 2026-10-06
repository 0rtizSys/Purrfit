# Prefix command framework

Since v3.0.0 every command is typed in chat with the server's prefix (`$>work`).
Only `/help`, `/dashboard` and `/support` are slash commands (`src/bot/commands/types.ts`).

```
message ──▶ dispatcher.ts ──▶ command.execute(ctx)
            prefix · command/alias · channel permissions · permission ·
            rate limit · subcommand · arguments (args.ts) · errors
```

## Writing a command

```ts
import type { PrefixCommand } from "../../../framework/types";

export const depositCommand: PrefixCommand = {
    name: "deposit", //            canonical name: logs, rate limits, docs
    aliases: ["dep", "d"], //      lowercase [a-z0-9_], unique across ALL commands
    description: "Move money from your wallet to your bank",
    permission: "everyone", //     "everyone" (default) | "admin" | "owner"
    args: [
        {
            name: "amount",
            kind: "amount", //       user | integer | amount | number | word | text | choice
            description: "Amount to deposit",
            min: MIN_AMOUNT,
            max: MAX_AMOUNT,
        },
    ],
    async execute(ctx) {
        const amount = ctx.args.integer("amount");
        // ctx.user, ctx.guildId, ctx.guild, ctx.prefix, ctx.isAdmin, ctx.client ...
        await sendSimpleEmbed(ctx, { title: "..." });
    },
};
```

A command with `subcommands` (like `crypto`) has no `args`/`execute` of its own;
each subcommand has its own `args` and `execute`.

### What the framework does for you (do not repeat it in a command)

- **Server only**: DMs never reach a command. No `requireGuild`.
- **Permissions**: set `permission`; the dispatcher refuses the others before
  `execute` runs. Do not re-check `Administrator` inside a command (the
  exception is a command that is public to read but admin to change, like
  `prefix`; use `ctx.isAdmin`).
- **Rate limit**: by canonical name (`services/rate_limit.ts`).
- **Argument errors**: a missing or invalid argument is answered with the usage
  line and `execute` is not called. Extra input is also an error.
- **Errors**: anything `execute` throws is logged (`Error ejecutando $>name`)
  and answered with a generic "Something went wrong". Do not wrap the whole
  command in `try/catch` just to log and call `internalErrorEmbed`. Catch only
  what you can handle (an insufficient balance, a cooldown...).
- **Mentions**: replies never ping anybody (`allowedMentions` is empty).

### Replying

- `sendSimpleEmbed(ctx, options)`, `sendErrorEmbed(ctx, title, text, hint?)` and the
  other helpers in `Helpers/simplified_embed_builder.ts` take the `ctx` (any `Replier`).
- There are **no ephemeral replies in chat**. Errors, cooldown notices and
  `eph: true` replies are _temporary_: the bot deletes them about 10 s later.
  Everything else stays in the channel. The old `visibility` option is gone:
  results are public.
- `await ctx.defer()` shows "typing…" while a slow command works (the old `deferReply`).
- Hints must show commands with the server's prefix: `cmd(ctx, "deposit <amount>")`
  (from `framework/context.ts`) gives `` `$>deposit <amount>` ``. Never hard-code `/deposit`.
- Files (charts): `files: [attachment]` in the embed options, as before.

### Arguments

| kind      | accepts                                                    | read with                 |
| --------- | ---------------------------------------------------------- | ------------------------- |
| `user`    | `@mention` or a user id (resolved, `.bot` is available)    | `ctx.args.user("target")` |
| `integer` | `1000`, `1,000`, `1_000`                                   | `integer`                 |
| `amount`  | like `integer`, plus `1k`, `2.5m`, `1b`                    | `integer`                 |
| `number`  | `2.5`, `2,5`, `2.5%`                                       | `number`                  |
| `word`    | one token, as typed                                        | `string`                  |
| `text`    | everything left (must be last)                             | `string`                  |
| `choice`  | one of `choices`, any case; returns the canonical spelling | `string`                  |

Optional arguments (`optional: true`) must come last; read them with the `…Opt`
variant (`ctx.args.integerOpt("amount")` is `null` when left out). Reading an
argument the command did not declare throws.

## Command names (the contract)

Renaming a command or alias is a breaking change: users, the docs and the
dashboard rely on these. `tests/command-registry.test.ts` pins the names.

| name                 | aliases                    | notes                                                                                             |
| -------------------- | -------------------------- | ------------------------------------------------------------------------------------------------- |
| `work`               | `w`                        |                                                                                                   |
| `wallet_balance`     | `wallet`, `bal`, `balance` |                                                                                                   |
| `bank_balance`       | `bank`, `bb`               |                                                                                                   |
| `deposit`            | `dep`, `d`                 | `<amount>`                                                                                        |
| `withdraw`           | `with`, `wd`               | `<amount>`                                                                                        |
| `transfer`           | `pay`, `send`              | `<user> <amount>`                                                                                 |
| `leaderboard`        | `lb`, `top`                | optional `by` choice                                                                              |
| `economy_info`       | `eco`, `info`              |                                                                                                   |
| `crypto`             | `c`                        | subcommands `market` (`m`), `chart` (`ch`), `buy` (`b`), `sell` (`s`), `portfolio` (`pf`, `port`) |
| `coinflip`           | `cf`, `flip`               |                                                                                                   |
| `add_balance`        | `addbal`                   | `permission: "admin"`                                                                             |
| `set_cooldown_time`  | `setcd`                    | `permission: "admin"`                                                                             |
| `set_economy_symbol` | `setsymbol`                | `permission: "admin"`                                                                             |
| `set_tax_rate`       | `settax`                   | `permission: "admin"`                                                                             |
| `set_interest_rate`  | `setinterest`              | `permission: "admin"`                                                                             |
| `prefix`             | `setprefix`                | done: reads for everyone, changes for admins                                                      |
| `ping`               |                            | done                                                                                              |
| `delete_my_data`     | `deletedata`               |                                                                                                   |
| `sync`               |                            | done, `permission: "owner"`                                                                       |

## Where things live

- `types.ts` command, argument, context and `Replier` types
- `args.ts` argument parser and usage text
- `registry.ts` name/alias index (throws at startup on a clash)
- `dispatcher.ts` the message pipeline
- `context.ts` replies for chat messages and slash interactions
- `prefix.ts` the prefix rules (the database and the web backend enforce the same ones)
- `manifest.ts` the command list written to `data/commands.json` for the dashboard
- the registry itself is `src/bot/syncer.ts`
