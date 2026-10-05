import * as fs from "fs";
import * as path from "path";
import type { MarketAsset } from "../bot/services/database/repository/crypto/market";

//? Contrato web <-> bot: el worker escribe este archivo, src/web/server.js lo
//? sirve en /api/market. La web nunca toca la base de datos.

export const MARKET_REFRESH_MS = 2 * 60 * 1000;

//? Mismo resultado desde src/shared (ts-node/tsx) y desde dist/shared.
export const SNAPSHOT_PATH =
    process.env.MARKET_SNAPSHOT_PATH ??
    path.resolve(__dirname, "..", "..", "data", "market.json");

export type MarketSnapshot = {
    updatedAt: string;
    refreshMs: number;
    assets: {
        symbol: string;
        name: string;
        price: number;
        change24hPct: number;
    }[];
};

export function buildSnapshot(
    assets: MarketAsset[],
    now: Date = new Date(),
): MarketSnapshot {
    return {
        updatedAt: now.toISOString(),
        refreshMs: MARKET_REFRESH_MS,
        assets: assets.map((a) => ({
            symbol: a.symbol,
            name: a.name,
            price: a.price,
            change24hPct:
                a.price24hAgo > 0
                    ? ((a.price - a.price24hAgo) / a.price24hAgo) * 100
                    : 0,
        })),
    };
}

//? Escritura atómica: el servidor web nunca lee un JSON a medias.
export function writeSnapshot(
    snapshot: MarketSnapshot,
    file: string = SNAPSHOT_PATH,
): void {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(snapshot));
    fs.renameSync(tmp, file);
}
