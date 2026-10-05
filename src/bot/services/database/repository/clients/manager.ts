import { pool } from "../../db";

type BalanceType = "wallet" | "bank";

//! Column names cannot be bound as query parameters, so every function that
//! interpolates `Type` must validate it against this allowlist first.
function assertBalanceType(Type: string): asserts Type is BalanceType {
    if (Type !== "wallet" && Type !== "bank")
        throw new Error("Invalid balance type");
}

//^ Get Balance Wallet Function

export async function getBalance(
    userId: string,
    guildId: string,
    Type: BalanceType,
): Promise<number> {
    /**
     * Read-only balance getter: a single query, no row is created
     * for users that have never used the economy (they have 0).
     */
    assertBalanceType(Type);
    const balanceResult = await pool.query(
        `SELECT ${Type} FROM clients WHERE guild_id=$1 AND user_id=$2`,
        [guildId, userId],
    );
    return Number(balanceResult.rows[0]?.[Type] ?? 0);
}

//^ Add Balance ( Prototype )

export async function addBalance(
    userId: string,
    guildId: string,
    Type: BalanceType,
    amn: number,
): Promise<number> {
    assertBalanceType(Type);
    const query = `
  INSERT INTO clients (user_id, guild_id, ${Type})
  VALUES ($1, $2, $3)
  ON CONFLICT (user_id, guild_id)
  DO UPDATE SET ${Type} = clients.${Type} + EXCLUDED.${Type}
  RETURNING ${Type};
  `;
    const result = await pool.query(query, [userId, guildId, amn]);
    return Number(result.rows[0][Type]);
}

/**
 * Atomically subtracts `amn` if the balance covers it.
 * Returns the new balance, or `null` when funds are insufficient
 * (including users with no row yet).
 */
export async function removeBalance(
    userId: string,
    guildId: string,
    Type: BalanceType,
    amn: number,
): Promise<number | null> {
    assertBalanceType(Type);
    const query = `
  UPDATE clients
  SET ${Type} = ${Type} - $3
  WHERE user_id = $1 AND guild_id = $2 AND ${Type} >= $3
  RETURNING ${Type};
  `;
    const result = await pool.query(query, [userId, guildId, amn]);
    return result.rowCount ? Number(result.rows[0][Type]) : null;
}
