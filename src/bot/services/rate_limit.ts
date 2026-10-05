/**
 * In-memory, per-user rate limiting for slash commands.
 *
 * Two layers:
 *  - a token bucket shared by every command (stops general spam),
 *  - an optional per-command cooldown (stops hammering one money command,
 *    e.g. /coinflip, faster than a human could play).
 *
 * Money safety does NOT depend on this: balances are protected by row locks
 * in the database. This only keeps load and abuse down. State is per process,
 * so it resets on restart, which is acceptable for these short windows.
 */

export type RateLimitConfig = {
    bucketCapacity: number;
    refillPerSecond: number;
    commandCooldownsMs: Record<string, number>;
};

export type RateLimitResult =
    | { allowed: true }
    | { allowed: false; retryAfterMs: number };

export const DEFAULT_RATE_LIMITS: RateLimitConfig = {
    bucketCapacity: 6,
    refillPerSecond: 0.5,
    commandCooldownsMs: {
        coinflip: 3_000,
        transfer: 3_000,
        crypto: 2_000,
        leaderboard: 5_000,
        delete_my_data: 10_000,
    },
};

type Bucket = { tokens: number; updatedAt: number };

export class RateLimiter {
    private readonly buckets = new Map<string, Bucket>();
    private readonly lastUse = new Map<string, number>();

    constructor(
        private readonly config: RateLimitConfig = DEFAULT_RATE_LIMITS,
    ) {}

    check(
        userId: string,
        commandName: string,
        now = Date.now(),
    ): RateLimitResult {
        //? Per-command cooldown first, so a rejected call does not burn a token
        const cooldown = this.config.commandCooldownsMs[commandName];
        const key = `${userId}:${commandName}`;
        if (cooldown) {
            const last = this.lastUse.get(key);
            if (last !== undefined && now - last < cooldown) {
                return {
                    allowed: false,
                    retryAfterMs: cooldown - (now - last),
                };
            }
        }

        const bucket = this.buckets.get(userId) ?? {
            tokens: this.config.bucketCapacity,
            updatedAt: now,
        };
        const elapsedSeconds = Math.max(now - bucket.updatedAt, 0) / 1000;
        bucket.tokens = Math.min(
            this.config.bucketCapacity,
            bucket.tokens + elapsedSeconds * this.config.refillPerSecond,
        );
        bucket.updatedAt = now;

        if (bucket.tokens < 1) {
            this.buckets.set(userId, bucket);
            const retryAfterMs = Math.ceil(
                ((1 - bucket.tokens) / this.config.refillPerSecond) * 1000,
            );
            return { allowed: false, retryAfterMs };
        }

        bucket.tokens -= 1;
        this.buckets.set(userId, bucket);
        if (cooldown) this.lastUse.set(key, now);
        return { allowed: true };
    }

    /** Drops entries that can no longer affect a decision, so memory stays bounded. */
    sweep(now = Date.now()): void {
        const fullAfterMs =
            (this.config.bucketCapacity / this.config.refillPerSecond) * 1000;
        for (const [user, bucket] of this.buckets) {
            if (now - bucket.updatedAt >= fullAfterMs)
                this.buckets.delete(user);
        }
        const longestCooldown = Math.max(
            0,
            ...Object.values(this.config.commandCooldownsMs),
        );
        for (const [key, last] of this.lastUse) {
            if (now - last >= longestCooldown) this.lastUse.delete(key);
        }
    }

    get size(): number {
        return this.buckets.size + this.lastUse.size;
    }
}
