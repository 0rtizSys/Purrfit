import type { PoolClient } from "pg";
import { pool } from "./db";

/**
 * Runs `fn` inside a single transaction on a dedicated client.
 * Commits when `fn` resolves, rolls back when it throws, and always
 * releases the client (destroying it if the rollback itself failed).
 */
export async function withTransaction<T>(
    fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
    const client = await pool.connect();
    let releaseError: Error | undefined;
    try {
        await client.query("BEGIN");
        const result = await fn(client);
        await client.query("COMMIT");
        return result;
    } catch (err) {
        try {
            await client.query("ROLLBACK");
        } catch (rollbackErr) {
            console.error("Error al hacer ROLLBACK:", rollbackErr);
            releaseError = rollbackErr as Error;
        }
        throw err;
    } finally {
        client.release(releaseError);
    }
}
