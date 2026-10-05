import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config();

//? When DATABASE_CA_CERT is set (Supabase > Database Settings > SSL certificate),
//? the server certificate is verified. Without it the connection is still
//? encrypted but not authenticated (kept for backwards compatibility).
const caCert = process.env.DATABASE_CA_CERT?.replace(/\\n/g, "\n");

export const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: caCert
        ? { ca: caCert, rejectUnauthorized: true }
        : { rejectUnauthorized: false },
    max: Number(process.env.DB_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
});

//! Without this listener an idle client error (e.g. the DB restarting)
//! is an unhandled 'error' event and crashes the whole bot.
pool.on("error", (err) => {
    console.error(
        "Error inesperado en un cliente inactivo de PostgreSQL:",
        err,
    );
});
