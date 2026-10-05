import { pool } from "../../db";
import type { PoolClient } from "pg";
import { cdTimeCache } from "./get_cd_time";

export const MAX_COOLDOWN_SECONDS = 2_592_000; // 30 days

export async function setCdTime(guildId: string, seconds: number) {
    if (!Number.isInteger(seconds) || seconds <= 0) {
        throw new Error("Seconds must be a positive integer.");
    }
    if (seconds > MAX_COOLDOWN_SECONDS) {
        throw new Error(`Seconds cannot exceed ${MAX_COOLDOWN_SECONDS}.`);
    }

    let client: PoolClient | undefined;

    try {
        client = await pool.connect();
        await client.query("BEGIN;");

        await client.query(
            `
            INSERT INTO server_configurations (guild_id, cooldown_time)
            VALUES ($1, $2)
            ON CONFLICT (guild_id)
            DO UPDATE SET cooldown_time = EXCLUDED.cooldown_time
            `,
            [guildId, seconds],
        );

        const cooldownEnd = Date.now() + seconds * 1000;

        await client.query(
            `
            UPDATE cooldowns_table
            SET cooldown = $2
            WHERE guild_id = $1
            AND cooldown > $2
            `,
            [guildId, cooldownEnd],
        );

        await client.query("COMMIT;");
        cdTimeCache.set(guildId, seconds);
        return false;
    } catch (err) {
        console.error(
            `Error de base de datos\narchivo: set_cd_time.ts\n${err}`,
        );
        try {
            await client?.query("ROLLBACK;");
        } catch (rollbackErr) {
            console.error(
                `Error al hacer ROLLBACK\narchivo: set_cd_time.ts\n${rollbackErr}`,
            );
        }
        return true;
    } finally {
        client?.release();
    }
}
