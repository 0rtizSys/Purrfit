import { Pool } from "pg";
import * as dotenv from "dotenv";
import { logger } from "../logger";

dotenv.config({ quiet: true });

//? When DATABASE_CA_CERT is set (Supabase > Database Settings > SSL certificate),
//? the server certificate is verified. Without it the connection is still
//? encrypted but not authenticated (kept for backwards compatibility).
//? DATABASE_SSL=disable is only meant for a local database (docker compose).
const caCert = process.env.DATABASE_CA_CERT?.replace(/\\n/g, "\n");
const sslDisabled = process.env.DATABASE_SSL === "disable";

export const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: sslDisabled
        ? false
        : caCert
          ? { ca: caCert, rejectUnauthorized: true }
          : { rejectUnauthorized: false },
    max: Number(process.env.DB_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
});

//! Without this listener an idle client error (e.g. the DB restarting)
//! is an unhandled 'error' event and crashes the whole bot.
pool.on("error", (err) => {
    logger.error("Error inesperado en un cliente inactivo de PostgreSQL", {
        error: err,
    });
});
