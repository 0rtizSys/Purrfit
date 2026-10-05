import { readdirSync, readFileSync } from "fs";
import path from "path";
import type { Pool } from "pg";

/**
 * Applies every `migrations/NNN_name.sql` file that has not run yet, in order,
 * each one in its own transaction. Applied files are recorded in
 * `schema_migrations`. A Postgres advisory lock makes concurrent runs
 * (two containers starting at once) wait for each other instead of racing.
 */

const MIGRATIONS_DIR = path.resolve(__dirname, "../../migrations");
const LOCK_KEY = 7_420_011; // arbitrary, unique to Purrfit migrations

export function listMigrationFiles(dir = MIGRATIONS_DIR): string[] {
    return readdirSync(dir)
        .filter((file) => /^\d{3}_[\w-]+\.sql$/.test(file))
        .sort();
}

export async function runMigrations(
    pool: Pool,
    log: (message: string) => void = console.log,
    dir = MIGRATIONS_DIR,
): Promise<string[]> {
    const client = await pool.connect();
    const applied: string[] = [];
    try {
        await client.query("SELECT pg_advisory_lock($1)", [LOCK_KEY]);
        await client.query(`
            CREATE TABLE IF NOT EXISTS public.schema_migrations (
                name       TEXT        PRIMARY KEY,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )`);
        const done = new Set(
            (
                await client.query("SELECT name FROM public.schema_migrations")
            ).rows.map((row) => row.name as string),
        );

        for (const file of listMigrationFiles(dir)) {
            if (done.has(file)) continue;
            const sql = readFileSync(path.join(dir, file), "utf8");
            log(`Aplicando migración ${file}...`);
            try {
                await client.query("BEGIN");
                await client.query(sql);
                await client.query(
                    "INSERT INTO public.schema_migrations (name) VALUES ($1)",
                    [file],
                );
                await client.query("COMMIT");
            } catch (err) {
                await client.query("ROLLBACK");
                throw new Error(
                    `La migración ${file} falló: ${(err as Error).message}`,
                );
            }
            applied.push(file);
        }
        return applied;
    } finally {
        await client
            .query("SELECT pg_advisory_unlock($1)", [LOCK_KEY])
            .catch(() => undefined);
        client.release();
    }
}

if (require.main === module) {
    (async () => {
        const { pool } = await import("../bot/services/database/db");
        try {
            const applied = await runMigrations(pool);
            console.log(
                applied.length
                    ? `✅ ${applied.length} migraciones aplicadas.`
                    : "✅ La base de datos ya está al día.",
            );
        } catch (err) {
            console.error("❌", (err as Error).message);
            process.exitCode = 1;
        } finally {
            await pool.end();
        }
    })();
}
