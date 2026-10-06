import { pool } from "../../db";
import { TtlCache } from "../../../cache/ttl_cache";
import { logger } from "../../../logger";
import { checkPrefix, DEFAULT_PREFIX } from "../../../../framework/prefix";

//? Read on every chat message of every server, so it is cached; a change made
//? from the web dashboard (another process) shows up within a minute.
export const prefixCache = new TtlCache<string>(60_000);

//? While the database is failing, answer with the default prefix instead of
//? sending a query (and a log line) for every message in every server.
const RETRY_AFTER_FAILURE_MS = 10_000;
let failedUntil = 0;
let lastWarnAt = 0;

/** The prefix of a server. Never throws: on a database error it is the default. */
export async function getPrefix(guildId: string): Promise<string> {
    const cached = prefixCache.get(guildId);
    if (cached !== undefined) return cached;
    if (Date.now() < failedUntil) return DEFAULT_PREFIX;

    try {
        const result = await pool.query(
            "SELECT prefix FROM server_configurations WHERE guild_id = $1",
            [guildId],
        );
        const prefix: string = result.rows[0]?.prefix ?? DEFAULT_PREFIX;
        prefixCache.set(guildId, prefix);
        return prefix;
    } catch (error) {
        const now = Date.now();
        failedUntil = now + RETRY_AFTER_FAILURE_MS;
        if (now - lastWarnAt > 60_000) {
            lastWarnAt = now;
            logger.warn(
                "No se pudo leer el prefijo, se usa el predeterminado",
                {
                    error,
                },
            );
        }
        return DEFAULT_PREFIX;
    }
}

export async function setPrefix(
    guildId: string,
    prefix: string,
): Promise<void> {
    const check = checkPrefix(prefix);
    if (!check.ok) throw new Error(check.reason);
    await pool.query(
        `INSERT INTO server_configurations (guild_id, prefix) VALUES ($1, $2)
         ON CONFLICT (guild_id) DO UPDATE SET prefix = EXCLUDED.prefix`,
        [guildId, check.prefix],
    );
    prefixCache.set(guildId, check.prefix);
}
