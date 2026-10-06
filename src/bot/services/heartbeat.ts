import { randomUUID } from "crypto";
import { readFileSync } from "fs";
import path from "path";
import type { Client } from "discord.js";
import { pool } from "./database/db";
import { logger } from "./logger";

export const HEARTBEAT_INTERVAL_MS = 30_000;
const CLEANUP_EVERY_MS = 20 * 60 * 1000;

export type HeartbeatStatus = "starting" | "running" | "stopping";

export type HeartbeatRow = {
    status: HeartbeatStatus;
    discordReady: boolean;
    pingMs: number | null;
    guilds: number;
    users: number;
    rssMb: number;
};

/** Builds the numbers of one heartbeat from the Discord client (no I/O). */
export function collectHeartbeat(
    client: Pick<Client, "isReady" | "ws" | "guilds">,
    status: HeartbeatStatus,
    rssBytes: number = process.memoryUsage().rss,
): HeartbeatRow {
    //? ws.ping is -1 until the first gateway heartbeat after login
    const ping = client.ws.ping;
    let users = 0;
    for (const guild of client.guilds.cache.values()) {
        users += guild.memberCount ?? 0;
    }
    return {
        status,
        discordReady: client.isReady(),
        pingMs: ping >= 0 ? Math.round(ping) : null,
        guilds: client.guilds.cache.size,
        users,
        rssMb: Math.round(rssBytes / (1024 * 1024)),
    };
}

/**
 * The fields of the optional `heartbeat` log line (see `HEARTBEAT_LOG`).
 * `wsPing` is the name the local monitor (monitor/) already looks for.
 */
export function heartbeatLogMeta(row: HeartbeatRow): Record<string, unknown> {
    return {
        wsPing: row.pingMs,
        discordReady: row.discordReady,
        guilds: row.guilds,
        users: row.users,
        rssMb: row.rssMb,
    };
}

function readVersion(): string | null {
    try {
        //? Same depth from src/ (tsx) and dist/ (compiled)
        const file = path.resolve(__dirname, "../../../package.json");
        return JSON.parse(readFileSync(file, "utf8")).version ?? null;
    } catch {
        return null;
    }
}

/**
 * Tells the rest of the system that this bot process is alive.
 *
 * One row per process in `bot_heartbeat`, refreshed every 30 s. A failed write
 * (database restarting...) is logged and never takes the bot down; the reader
 * simply sees the heartbeat go stale.
 */
export class Heartbeat {
    private readonly instanceId = randomUUID();
    private readonly startedAt = new Date();
    private readonly version = readVersion();
    private timer: NodeJS.Timeout | null = null;
    private status: HeartbeatStatus = "starting";
    private lastEvent: { at: Date; kind: string } | null = null;
    private lastCleanup = 0;
    private lastErrorLogAt = 0;

    constructor(private readonly client: Client) {}

    start(): void {
        if (this.timer) return;
        void this.beat();
        this.timer = setInterval(() => void this.beat(), HEARTBEAT_INTERVAL_MS);
        this.timer.unref();
    }

    /** Marks the process as fully running (call once the Discord client is ready). */
    markRunning(): void {
        this.status = "running";
        void this.beat();
    }

    /** Remembers the last relevant event (e.g. "command", "guild_join"). */
    noteEvent(kind: string): void {
        this.lastEvent = { at: new Date(), kind };
    }

    /** Stops the timer and tells readers this process is going away. */
    async stop(): Promise<void> {
        if (this.timer) clearInterval(this.timer);
        this.timer = null;
        this.status = "stopping";
        await this.beat();
    }

    private async beat(): Promise<void> {
        const row = collectHeartbeat(this.client, this.status);
        //? Off by default (two lines a minute are noise on a host). The local
        //? monitor turns it on to chart the gateway ping; it works even when
        //? the database below is down.
        if (process.env.HEARTBEAT_LOG === "true") {
            logger.info("heartbeat", heartbeatLogMeta(row));
        }
        try {
            await pool.query(
                `INSERT INTO bot_heartbeat
                     (instance_id, started_at, beat_at, status, discord_ready, ping_ms,
                      guilds, users, version, environment, rss_mb, last_event_at, last_event)
                 VALUES ($1, $2, now(), $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                 ON CONFLICT (instance_id) DO UPDATE SET
                     beat_at = now(), status = EXCLUDED.status,
                     discord_ready = EXCLUDED.discord_ready, ping_ms = EXCLUDED.ping_ms,
                     guilds = EXCLUDED.guilds, users = EXCLUDED.users,
                     rss_mb = EXCLUDED.rss_mb, last_event_at = EXCLUDED.last_event_at,
                     last_event = EXCLUDED.last_event`,
                [
                    this.instanceId,
                    this.startedAt,
                    row.status,
                    row.discordReady,
                    row.pingMs,
                    row.guilds,
                    row.users,
                    this.version,
                    process.env.NODE_ENV ?? "development",
                    row.rssMb,
                    this.lastEvent?.at ?? null,
                    this.lastEvent?.kind ?? null,
                ],
            );
            const now = Date.now();
            if (now - this.lastCleanup > CLEANUP_EVERY_MS) {
                this.lastCleanup = now;
                await pool.query(
                    `DELETE FROM bot_heartbeat WHERE beat_at < now() - interval '1 day'`,
                );
            }
        } catch (error) {
            //? Throttled: a database outage must not flood the logs
            const now = Date.now();
            if (now - this.lastErrorLogAt > 5 * 60 * 1000) {
                this.lastErrorLogAt = now;
                logger.warn("No se pudo escribir el heartbeat", { error });
            }
        }
    }
}
