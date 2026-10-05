import { pool } from "../../db";
import { TtlCache } from "../../../cache/ttl_cache";

export const ecoSymbolCache = new TtlCache<string>(60_000);

export async function getEcoSymbol(guildId: string): Promise<string> {
    const cached = ecoSymbolCache.get(guildId);
    if (cached !== undefined) return cached;

    const results = await pool.query(
        `
        SELECT economy_symbol
        FROM server_configurations
        WHERE guild_id = $1
        `,
        [guildId],
    );
    const symbol: string = results.rows[0]?.economy_symbol ?? "$";
    ecoSymbolCache.set(guildId, symbol);
    return symbol;
}
