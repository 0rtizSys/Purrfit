import { runMarketTick } from "../database/repository/jobs/market_tick";
import { runBankInterest } from "../database/repository/jobs/bank_interest";
import { TICK_INTERVAL_MS } from "../economy/market_sim";
import { logger } from "../logger";

const INTEREST_CHECK_MS = 10 * 60 * 1000;

/**
 * Runs the background jobs (crypto prices, daily bank interest).
 * Both jobs claim their run in the database, so starting this in more
 * than one process is safe: only one of them does the work each time.
 */
export class Scheduler {
    private timers: NodeJS.Timeout[] = [];
    private running = new Set<Promise<unknown>>();

    start(): void {
        this.every(TICK_INTERVAL_MS, "crypto_tick", async () => {
            const result = await runMarketTick();
            if (result.ran && result.backfilled)
                logger.info("Historial de precios inicial generado", {
                    points: result.backfilled,
                });
        });
        this.every(INTEREST_CHECK_MS, "bank_interest", async () => {
            const result = await runBankInterest();
            if (result.ran)
                logger.info("Intereses bancarios pagados", {
                    accounts: result.accountsPaid,
                });
        });
    }

    /** Stops the timers and waits for a job that is mid-run to finish. */
    async stop(): Promise<void> {
        this.timers.forEach(clearInterval);
        this.timers = [];
        await Promise.allSettled([...this.running]);
    }

    private every(ms: number, name: string, job: () => Promise<void>) {
        let busy = false;
        const run = () => {
            if (busy) return;
            busy = true;
            const p = job()
                .catch((error) =>
                    logger.error(`Falló el job ${name}`, { error }),
                )
                .finally(() => {
                    busy = false;
                    this.running.delete(p);
                });
            this.running.add(p);
        };
        run();
        const timer = setInterval(run, ms);
        timer.unref();
        this.timers.push(timer);
    }
}
