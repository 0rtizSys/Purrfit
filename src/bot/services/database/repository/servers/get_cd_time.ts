import { pool } from "../../db";
import { TtlCache } from "../../../cache/ttl_cache";

export const cdTimeCache = new TtlCache<number>(60_000);

export async function getCdTime(guildId: string): Promise<number> {
    const cached = cdTimeCache.get(guildId);
    if (cached !== undefined) return cached;

    const results = await pool.query(
        `
        SELECT cooldown_time
        FROM server_configurations
        WHERE guild_id = $1
        `,
        [guildId],
    );
    const seconds = Number(results.rows[0]?.cooldown_time ?? 1800); // seconds
    cdTimeCache.set(guildId, seconds);
    return seconds;
}
