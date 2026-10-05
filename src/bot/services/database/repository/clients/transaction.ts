import { withTransaction } from "../../transaction";

export type TransferResult =
    | { ok: true }
    | { ok: false; reason: "insufficient_funds"; currentBalance: number };

/**
 * Transfers bank balance between two users atomically (ACID).
 *
 * Both rows are created if missing and then locked in a fixed order
 * (by user_id), so A->B and B->A running at the same time queue up
 * instead of deadlocking.
 */
export async function transferSafe(
    userId: string,
    targetId: string,
    guildId: string,
    amount: number,
): Promise<TransferResult> {
    if (userId === targetId) throw new Error("Cannot transfer to yourself");

    const ordered = [userId, targetId].sort();

    return withTransaction(async (client) => {
        await client.query(
            `INSERT INTO clients (user_id, guild_id, wallet, bank)
             VALUES ($1, $3, 0, 0), ($2, $3, 0, 0)
             ON CONFLICT (user_id, guild_id) DO NOTHING`,
            [ordered[0], ordered[1], guildId],
        );

        const locked = await client.query(
            `SELECT user_id, bank
             FROM clients
             WHERE guild_id = $1 AND user_id = ANY($2::text[])
             ORDER BY user_id
             FOR UPDATE`,
            [guildId, ordered],
        );

        const senderRow = locked.rows.find((r) => r.user_id === userId);
        const senderBank = Number(senderRow?.bank ?? 0);
        if (senderBank < amount) {
            return {
                ok: false,
                reason: "insufficient_funds",
                currentBalance: senderBank,
            };
        }

        await client.query(
            `UPDATE clients
             SET bank = bank + CASE WHEN user_id = $1 THEN -$3::bigint ELSE $3::bigint END
             WHERE guild_id = $4 AND user_id IN ($1, $2)`,
            [userId, targetId, amount, guildId],
        );

        return { ok: true };
    });
}
