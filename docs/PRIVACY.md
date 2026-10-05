# Purrfit Privacy Policy

_Last updated: 2026-10-05_

Purrfit ("the bot") is a Discord bot that runs a simulated, server-based economy. This policy explains what the bot stores, why, and how you can delete it.

## What we store

Purrfit only stores what it needs to run the economy:

| Data | Why |
|---|---|
| Your Discord user ID | To know which balance belongs to you |
| Discord server (guild) IDs | Balances and settings are separate in every server |
| Your wallet and bank balances | The economy itself |
| Your simulated crypto holdings and what you paid for them | The `/crypto` feature |
| When your `/work` cooldown ends | To enforce the cooldown |
| Server settings chosen by admins (symbol, cooldown, tax and interest rates, treasury) | To apply each server's rules |

Purrfit does **not** read or store your messages, your username, avatar, email, IP address, voice data or any content outside of the slash commands you run. It does not use the Message Content intent.

All money and coins are fictional. They have no real-world value and cannot be bought, sold or withdrawn.

## Logs

The bot writes technical logs (errors, the server ID where an error happened, and the user ID when someone deletes their data) to diagnose problems. Logs are kept by the hosting provider for a limited time and are never sold or shared.

## Sharing

We do not sell, rent or share your data. Data is stored in a PostgreSQL database run by the bot's hosting provider and is only used to operate the bot.

## Deleting your data

- Run `/delete_my_data confirm:True` to permanently delete your balances and crypto holdings in **every** server. An active `/work` cooldown is kept until it expires (a few minutes or hours) so it cannot be used to skip the cooldown.
- Server data (settings and treasury) can be deleted on request by a server administrator through the support server.

## Children

Purrfit follows Discord's Terms of Service, which require users to be at least 13 years old (or the minimum age in your country).

## Changes

If this policy changes, the date at the top will be updated. Continuing to use the bot after a change means you accept the new version.

## Contact

Questions or deletion requests: join the support server linked in `/help`.
