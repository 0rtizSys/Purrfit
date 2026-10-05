import { withTransaction } from "../../transaction";

export type BalanceMoveResult =
    | { ok: true }
    | { ok: false; reason: "insufficient_funds"; currentBalance: number };

/**
 * Moves `amount` between the wallet and bank of the same user.
 * The balance check and the update happen under the same row lock,
 * so parallel deposits/withdrawals cannot overdraw.
 */
export async function transferInternalSafe(
    userId: string,
    guildId: string,
    amount: number,
    from: "wallet" | "bank",
    to: "wallet" | "bank",
): Promise<BalanceMoveResult> {
    const allowed = ["wallet", "bank"];
    if (!allowed.includes(from) || !allowed.includes(to) || from === to)
        throw new Error("Invalid balance types");

    return withTransaction(async (client) => {
        const current = await client.query(
            `SELECT ${from} FROM clients
       WHERE user_id=$1 AND guild_id=$2
       FOR UPDATE`,
            [userId, guildId],
        );
        const balance = Number(current.rows[0]?.[from] ?? 0);
        if (balance < amount) {
            return {
                ok: false,
                reason: "insufficient_funds",
                currentBalance: balance,
            };
        }
        await client.query(
            `UPDATE clients
       SET ${from} = ${from} - $1,
           ${to} = ${to} + $1
       WHERE user_id=$2 AND guild_id=$3`,
            [amount, userId, guildId],
        );
        return { ok: true };
    });
}
