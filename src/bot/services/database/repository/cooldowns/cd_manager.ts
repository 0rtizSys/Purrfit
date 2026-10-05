import type { PoolClient } from "pg";

export type CooldownClaim =
    | { claimed: true; cooldownEnd: number }
    | { claimed: false; remaining: number };

/**
 * Atomically checks and sets a cooldown inside the caller's transaction.
 *
 * The upsert only overwrites the row when the previous cooldown already
 * expired, and Postgres locks the conflicting row while evaluating it, so
 * concurrent calls for the same user serialize: exactly one of them claims
 * the cooldown, the rest see it as active. This replaces the old
 * check -> pay -> set sequence, which let parallel /work calls all pass.
 */
export async function claimCooldown(
    client: PoolClient,
    guildId: string,
    userId: string,
    durationMs: number,
): Promise<CooldownClaim> {
    const now = Date.now();
    const cooldownEnd = now + durationMs;

    const claim = await client.query(
        `
        INSERT INTO cooldowns_table (guild_id, user_id, cooldown)
        VALUES ($1, $2, $3)
        ON CONFLICT (guild_id, user_id)
        DO UPDATE SET cooldown = EXCLUDED.cooldown
        WHERE cooldowns_table.cooldown <= $4
        RETURNING cooldown
        `,
        [guildId, userId, cooldownEnd, now],
    );

    if (claim.rowCount && claim.rowCount > 0) {
        return { claimed: true, cooldownEnd };
    }

    const current = await client.query(
        `SELECT cooldown FROM cooldowns_table WHERE guild_id = $1 AND user_id = $2`,
        [guildId, userId],
    );
    const activeEnd = Number(current.rows[0]?.cooldown ?? now);
    return { claimed: false, remaining: Math.max(activeEnd - now, 0) };
}
