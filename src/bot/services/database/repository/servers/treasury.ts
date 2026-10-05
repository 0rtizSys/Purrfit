import type { PoolClient } from "pg";
import { DEFAULT_TAX_BPS } from "../../../economy/policy";

/** Reads the tax rate inside the caller's transaction (no cache: money depends on it). */
export async function readTaxBps(
    client: PoolClient,
    guildId: string,
): Promise<number> {
    const result = await client.query(
        `SELECT tax_bps FROM server_configurations WHERE guild_id = $1`,
        [guildId],
    );
    return Number(result.rows[0]?.tax_bps ?? DEFAULT_TAX_BPS);
}

/** Adds collected tax to the server treasury inside the caller's transaction. */
export async function addToTreasury(
    client: PoolClient,
    guildId: string,
    amount: number,
): Promise<void> {
    if (amount <= 0) return;
    await client.query(
        `INSERT INTO server_configurations (guild_id, treasury) VALUES ($1, $2)
         ON CONFLICT (guild_id) DO UPDATE
         SET treasury = server_configurations.treasury + EXCLUDED.treasury`,
        [guildId, amount],
    );
}
