# Purrfit Privacy Policy

_Version: 2.0 · Last updated: 2026-10-05_

Purrfit is made of two parts: a Discord bot ("the bot") that runs a simulated, server-based economy, and a website ("the website") where you can sign in with Discord and see the status of the bot. This policy explains what each part stores, why, and how you can delete it.

## The bot: what we store

The bot only stores what it needs to run the economy:

| Data | Why |
|---|---|
| Your Discord user ID | To know which balance belongs to you |
| Discord server (guild) IDs | Balances and settings are separate in every server |
| Your wallet and bank balances | The economy itself |
| Your simulated crypto holdings and what you paid for them | The `/crypto` feature |
| When your `/work` cooldown ends | To enforce the cooldown |
| Server settings chosen by admins (symbol, cooldown, tax and interest rates, treasury) | To apply each server's rules |

The bot does **not** read or store your messages, your username, avatar, email, IP address, voice data or any content outside of the slash commands you run. It does not use the Message Content intent.

The bot also reports a technical "heartbeat" about itself (whether it is running, its latency, how many servers it is in, its version and memory use). It contains no personal data.

All money and coins are fictional. They have no real-world value and cannot be bought, sold or withdrawn.

## The website: signing in

You sign in **only with Discord**. Purrfit never sees or stores a password. The website asks Discord for the `identify` permission, which is the lowest level: it does not give access to your email, your servers, your friends or your messages.

From Discord we receive and store:

| Data | Why |
|---|---|
| Your Discord user ID | To recognize your account |
| Your username and display name | To show who is signed in |
| Your avatar identifier | To show your avatar (the image itself is loaded from Discord's servers) |

We also store the dates of your account creation and last sign-in, and an account status (active or suspended).

The access token Discord gives us during sign-in is used once to read the data above and is then revoked. We do not keep it.

## The website: sessions and cookies

The website uses only the cookies it needs to work. It does not use advertising or analytics cookies.

- **Session cookie**: keeps you signed in. It is not readable by scripts on the page and is only sent over HTTPS in production. A session ends after 12 hours without activity, or after 7 days in total, or when you sign out. Signing out ends the session on our side too, not only in your browser.
- **Sign-in cookie**: a short-lived cookie (10 minutes) that exists only while you are being sent to Discord and back, to check that the sign-in you started is the one that returns.

For each session we store the date it was created, last used and when it expires or was ended, plus the first 200 characters of your browser's user-agent text so you can recognize your sessions. Sessions are deleted 30 days after they expire or end.

## Terms and privacy acceptance

When you register, you must tick a box confirming that you accept the Terms of Service and this Privacy Policy. We store which document, which version and when you accepted it. If a document changes in a way that needs your acceptance again, the dashboard asks you before showing you anything else. We never mark a document as accepted for you.

## Logs

The website writes technical logs to diagnose problems: the request's method, page path (without the query string), response status, duration, a request identifier and, if you are signed in, your internal account identifier. Errors also go to these logs without tokens, cookies or secrets. Short-term counters of recent requests per IP address are kept in memory to block abuse and are not written to the database. The hosting provider may keep its own access logs (including IP addresses) for a limited time. Logs are never sold or shared.

## Third parties

- **Discord** provides the sign-in and your identity data, and serves your avatar.
- **Google Fonts** serves the fonts of the website, so your browser contacts Google when loading a page.
- **The hosting provider** runs the bot, the website and its PostgreSQL database, and only processes data to operate them.

We do not sell, rent or share your data with anyone else.

## Deleting your data

- **Website account**: in the dashboard, "Delete account" permanently deletes your website account, your sessions and your acceptance records.
- **Bot data**: run `/delete_my_data confirm:True` to permanently delete your balances and crypto holdings in **every** server. An active `/work` cooldown is kept until it expires (a few minutes or hours) so it cannot be used to skip the cooldown.
- **Server data** (settings and treasury) can be deleted on request by a server administrator through the support server.

Deleting your website account does not delete your bot data, and the other way around.

## Children

Purrfit follows Discord's Terms of Service, which require users to be at least 13 years old (or the minimum age in your country).

## Changes

If this policy changes, the version and the date at the top will be updated. When the change needs your acceptance, the dashboard will ask for it. Continuing to use the bot after a change means you accept the new version.

## Contact

Questions or deletion requests: join the support server linked in `/help` and on the website.
