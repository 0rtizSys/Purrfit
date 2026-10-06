import type { Guild } from "discord.js";
import { pool } from "../../db";
import { logger } from "../../../logger";

//? The servers the bot is in, for the web dashboard (migration 005).
//? Writing here must never break the bot, so every function logs and swallows
//? its own errors.

export type GuildRow = {
    id: string;
    name: string;
    icon: string | null;
    memberCount: number;
};

/** What the table stores about a Discord guild, within the column limits. */
export function toGuildRow(
    guild: Pick<Guild, "id" | "name" | "icon" | "memberCount">,
): GuildRow {
    return {
        id: guild.id,
        name: guild.name.slice(0, 100) || "Unknown",
        icon: guild.icon ?? null,
        memberCount: Math.max(0, guild.memberCount ?? 0),
    };
}

const UPSERT = `
    INSERT INTO bot_guilds (guild_id, name, icon_hash, member_count, joined_at, left_at, updated_at)
    SELECT id, name, icon, members, now(), NULL, now()
    FROM unnest($1::text[], $2::text[], $3::text[], $4::int[]) AS t(id, name, icon, members)
    ON CONFLICT (guild_id) DO UPDATE SET
        name = EXCLUDED.name,
        icon_hash = EXCLUDED.icon_hash,
        member_count = EXCLUDED.member_count,
        updated_at = now(),
        --? Coming back after leaving counts as a new join
        joined_at = CASE WHEN bot_guilds.left_at IS NULL THEN bot_guilds.joined_at ELSE now() END,
        left_at = NULL`;

async function upsertRows(rows: GuildRow[]): Promise<void> {
    if (rows.length === 0) return;
    await pool.query(UPSERT, [
        rows.map((r) => r.id),
        rows.map((r) => r.name),
        rows.map((r) => r.icon),
        rows.map((r) => r.memberCount),
    ]);
}

/** The bot joined a server, or a server it is in changed its name or icon. */
export async function recordGuild(guild: Guild): Promise<void> {
    try {
        await upsertRows([toGuildRow(guild)]);
    } catch (error) {
        logger.warn("No se pudo guardar el servidor", {
            error,
            guildId: guild.id,
        });
    }
}

/** The bot was removed from a server. */
export async function recordGuildLeft(guildId: string): Promise<void> {
    try {
        await pool.query(
            `UPDATE bot_guilds SET left_at = now(), updated_at = now()
             WHERE guild_id = $1 AND left_at IS NULL`,
            [guildId],
        );
    } catch (error) {
        logger.warn("No se pudo marcar la salida del servidor", {
            error,
            guildId,
        });
    }
}

/**
 * On start: store every server the bot is in and mark the rest as left
 * (it may have been removed while it was offline).
 */
export async function syncGuilds(guilds: Iterable<Guild>): Promise<void> {
    try {
        const rows = [...guilds].map(toGuildRow);
        await upsertRows(rows);
        await pool.query(
            `UPDATE bot_guilds SET left_at = now(), updated_at = now()
             WHERE left_at IS NULL AND guild_id <> ALL($1::text[])`,
            [rows.map((r) => r.id)],
        );
    } catch (error) {
        logger.warn("No se pudo sincronizar la lista de servidores", { error });
    }
}
