import { pool } from "../../db";
import { ecoSymbolCache } from "./get_eco_symbol";

export async function setEcoSymbol(guildId: string, symbol: string) {
    try {
        await pool.query(
            `
            INSERT INTO server_configurations (guild_id, economy_symbol)
            VALUES ($1, $2)
            ON CONFLICT(guild_id)
            DO UPDATE SET economy_symbol = EXCLUDED.economy_symbol
            `,
            [guildId, symbol],
        );
        ecoSymbolCache.set(guildId, symbol);
        return true;
    } catch (e) {
        console.log(e);
        return false;
    }
}
