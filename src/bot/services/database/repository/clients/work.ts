import { withTransaction } from "../../transaction";
import { claimCooldown } from "../cooldowns/cd_manager";

export type WorkResult =
    | { ok: true; newBalance: number }
    | { ok: false; reason: "cooldown"; remaining: number };

/**
 * Claims the /work cooldown and pays the reward in one transaction:
 * either both happen or neither does.
 */
export async function claimWorkReward(
    userId: string,
    guildId: string,
    reward: number,
    cooldownMs: number,
): Promise<WorkResult> {
    return withTransaction(async (client) => {
        const cooldown = await claimCooldown(
            client,
            guildId,
            userId,
            cooldownMs,
        );
        if (!cooldown.claimed) {
            return {
                ok: false,
                reason: "cooldown",
                remaining: cooldown.remaining,
            };
        }

        const result = await client.query(
            `
            INSERT INTO clients (user_id, guild_id, wallet, bank)
            VALUES ($1, $2, $3, 0)
            ON CONFLICT (user_id, guild_id)
            DO UPDATE SET wallet = clients.wallet + EXCLUDED.wallet
            RETURNING wallet
            `,
            [userId, guildId, reward],
        );
        return { ok: true, newBalance: Number(result.rows[0].wallet) };
    });
}
