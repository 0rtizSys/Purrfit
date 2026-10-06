import { listMarket } from "../bot/services/database/repository/crypto/market";
import { pool } from "../bot/services/database/db";
import { logger } from "../bot/services/logger";
import {
    MARKET_REFRESH_MS,
    SNAPSHOT_PATH,
    buildSnapshot,
    writeSnapshot,
} from "./market_snapshot";

/**
 * Worker: cada 2 minutos lee los precios reales (listMarket, la misma función
 * que usa /crypto market) y publica el snapshot para la landing.
 * Si la base de datos falla se conserva el último snapshot.
 */
let busy = false;

async function refresh(): Promise<void> {
    if (busy) return;
    busy = true;
    try {
        const assets = await listMarket();
        writeSnapshot(buildSnapshot(assets));
        logger.debug("Snapshot del mercado actualizado", {
            coins: assets.length,
        });
    } catch (error) {
        logger.error("No se pudo actualizar el snapshot del mercado", {
            error,
        });
    } finally {
        busy = false;
    }
}

async function main(): Promise<void> {
    logger.info("Market worker iniciado", {
        everyMs: MARKET_REFRESH_MS,
        file: SNAPSHOT_PATH,
    });
    await refresh();
    const timer = setInterval(() => void refresh(), MARKET_REFRESH_MS);

    const shutdown = async (signal: string) => {
        logger.info(`${signal} recibido, cerrando market worker`);
        clearInterval(timer);
        await pool.end().catch(() => undefined);
        process.exit(0);
    };
    process.on("SIGINT", () => void shutdown("SIGINT"));
    process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

void main();
