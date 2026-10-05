import { withTransaction } from "../../transaction";

export type WalletWagerResult =
    | {
          ok: true;
          previousBalance: number;
          newBalance: number;
      }
    | {
          ok: false;
          reason: "insufficient_funds";
          currentBalance: number;
      };

export async function applyWalletWager(
    userId: string,
    guildId: string,
    amount: number,
    balanceDelta: number,
): Promise<WalletWagerResult> {
    return withTransaction(async (client) => {
        await client.query(
            `
      INSERT INTO clients (user_id, guild_id, wallet, bank)
      VALUES ($1, $2, 0, 0)
      ON CONFLICT (user_id, guild_id) DO NOTHING
      `,
            [userId, guildId],
        );

        const balanceResult = await client.query(
            `
      SELECT wallet
      FROM clients
      WHERE user_id = $1 AND guild_id = $2
      FOR UPDATE
      `,
            [userId, guildId],
        );

        const previousBalance = Number(balanceResult.rows[0].wallet);

        if (previousBalance < amount) {
            return {
                ok: false,
                reason: "insufficient_funds",
                currentBalance: previousBalance,
            };
        }

        const updateResult = await client.query(
            `
      UPDATE clients
      SET wallet = wallet + $1
      WHERE user_id = $2 AND guild_id = $3
      RETURNING wallet
      `,
            [balanceDelta, userId, guildId],
        );

        return {
            ok: true,
            previousBalance,
            newBalance: Number(updateResult.rows[0].wallet),
        };
    });
}
