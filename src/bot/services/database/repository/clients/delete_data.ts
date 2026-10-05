import { withTransaction } from "../../transaction";

export type DeletedData = {
    balances: number;
    holdings: number;
    cooldowns: number;
};

/**
 * Deletes everything Purrfit stores about a user, in every server.
 *
 * Active /work cooldowns are kept until they expire: otherwise moving money
 * to another account, deleting data and working again would skip the cooldown.
 * Expired cooldowns are removed.
 */
export async function deleteUserData(
    userId: string,
    now: number = Date.now(),
): Promise<DeletedData> {
    return withTransaction(async (client) => {
        const holdings = await client.query(
            `DELETE FROM crypto_holdings WHERE user_id = $1`,
            [userId],
        );
        const balances = await client.query(
            `DELETE FROM clients WHERE user_id = $1`,
            [userId],
        );
        const cooldowns = await client.query(
            `DELETE FROM cooldowns_table WHERE user_id = $1 AND cooldown <= $2`,
            [userId, now],
        );
        return {
            balances: balances.rowCount ?? 0,
            holdings: holdings.rowCount ?? 0,
            cooldowns: cooldowns.rowCount ?? 0,
        };
    });
}
