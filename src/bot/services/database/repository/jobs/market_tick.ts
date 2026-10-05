import { withTransaction } from "../../transaction";
import {
    gaussian,
    nextPrice,
    TICK_INTERVAL_MS,
} from "../../../economy/market_sim";

const HISTORY_RETENTION = "35 days";
const BACKFILL_DAYS = 7;

export type TickResult =
    | { ran: false }
    | { ran: true; updated: number; backfilled: number };

/**
 * Advances every simulated coin by one tick.
 *
 * The run is claimed through `scheduled_jobs` under a row lock, so if two bot
 * instances are alive at once (e.g. during a deploy) only one of them ticks.
 * A coin without any history gets a week of simulated past prices, so charts
 * are not empty on a fresh install.
 */
export async function runMarketTick(
    now: Date = new Date(),
    random: () => number = Math.random,
): Promise<TickResult> {
    return withTransaction(async (client) => {
        const job = await client.query(
            `SELECT last_run FROM scheduled_jobs WHERE name = 'crypto_tick' FOR UPDATE`,
        );
        const lastRun = job.rowCount
            ? new Date(job.rows[0].last_run)
            : new Date(0);
        //? 90% of the interval: timers drift a little, don't skip a tick for it
        if (now.getTime() - lastRun.getTime() < TICK_INTERVAL_MS * 0.9) {
            return { ran: false };
        }

        const assets = await client.query(
            `SELECT a.symbol, a.price, a.base_price, a.volatility,
                    EXISTS (SELECT 1 FROM crypto_price_history h WHERE h.symbol = a.symbol) AS has_history
             FROM crypto_assets a ORDER BY a.symbol FOR UPDATE OF a`,
        );

        let backfilled = 0;
        for (const asset of assets.rows) {
            const base = Number(asset.base_price);
            const volatility = Number(asset.volatility);
            let price = Number(asset.price);

            if (!asset.has_history) {
                const steps =
                    (BACKFILL_DAYS * 24 * 60 * 60 * 1000) / TICK_INTERVAL_MS;
                const times: Date[] = [];
                const prices: number[] = [];
                for (let i = steps; i >= 1; i--) {
                    price = nextPrice(
                        price,
                        base,
                        volatility,
                        TICK_INTERVAL_MS,
                        gaussian(random),
                    );
                    times.push(new Date(now.getTime() - i * TICK_INTERVAL_MS));
                    prices.push(price);
                }
                await client.query(
                    `INSERT INTO crypto_price_history (symbol, recorded_at, price)
                     SELECT $1, t, p FROM unnest($2::timestamptz[], $3::numeric[]) AS x(t, p)
                     ON CONFLICT DO NOTHING`,
                    [asset.symbol, times, prices],
                );
                backfilled += prices.length;
            }

            //? A long outage counts as one tick: no giant jump after downtime
            price = nextPrice(
                price,
                base,
                volatility,
                TICK_INTERVAL_MS,
                gaussian(random),
            );
            await client.query(
                `UPDATE crypto_assets SET price = $2, updated_at = $3 WHERE symbol = $1`,
                [asset.symbol, price, now],
            );
            await client.query(
                `INSERT INTO crypto_price_history (symbol, recorded_at, price)
                 VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
                [asset.symbol, now, price],
            );
        }

        await client.query(
            `DELETE FROM crypto_price_history WHERE recorded_at < $1::timestamptz - $2::interval`,
            [now, HISTORY_RETENTION],
        );
        await client.query(
            `INSERT INTO scheduled_jobs (name, last_run) VALUES ('crypto_tick', $1)
             ON CONFLICT (name) DO UPDATE SET last_run = EXCLUDED.last_run`,
            [now],
        );
        return { ran: true, updated: assets.rowCount ?? 0, backfilled };
    });
}
