import { pool } from "../../db";

export type LeaderboardSort = "total" | "wallet" | "bank";

export type LeaderboardEntry = {
    userId: string;
    wallet: number;
    bank: number;
    total: number;
};

//! The sort column is interpolated, so it must come from this map only
const SORT_SQL: Record<LeaderboardSort, string> = {
    total: "(wallet + bank)",
    wallet: "wallet",
    bank: "bank",
};

export async function getLeaderboard(
    guildId: string,
    sort: LeaderboardSort,
    limit = 10,
): Promise<LeaderboardEntry[]> {
    const column = SORT_SQL[sort];
    if (!column) throw new Error("Invalid leaderboard sort");
    const result = await pool.query(
        `SELECT user_id, wallet, bank, (wallet + bank) AS total
         FROM clients
         WHERE guild_id = $1 AND ${column} > 0
         ORDER BY ${column} DESC, user_id
         LIMIT $2`,
        [guildId, limit],
    );
    return result.rows.map((row) => ({
        userId: row.user_id,
        wallet: Number(row.wallet),
        bank: Number(row.bank),
        total: Number(row.total),
    }));
}

/** 1-based rank of the user, or null when they have nothing in that column. */
export async function getUserRank(
    userId: string,
    guildId: string,
    sort: LeaderboardSort,
): Promise<number | null> {
    const column = SORT_SQL[sort];
    if (!column) throw new Error("Invalid leaderboard sort");
    const result = await pool.query(
        `WITH me AS (
             SELECT ${column} AS score FROM clients WHERE guild_id = $1 AND user_id = $2
         )
         SELECT (SELECT score FROM me) AS score,
                (SELECT COUNT(*) FROM clients, me
                 WHERE guild_id = $1 AND (${column} > me.score
                    OR (${column} = me.score AND user_id < $2))) AS ahead`,
        [guildId, userId],
    );
    const row = result.rows[0];
    if (!row || row.score === null || Number(row.score) <= 0) return null;
    return Number(row.ahead) + 1;
}
