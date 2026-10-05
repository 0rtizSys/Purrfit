import { RateLimiter } from "../services/rate_limit";

const config = {
    bucketCapacity: 3,
    refillPerSecond: 1,
    commandCooldownsMs: { coinflip: 3_000 },
};

describe("RateLimiter", () => {
    it("allows a burst up to capacity and then refills over time", () => {
        const limiter = new RateLimiter(config);
        expect(limiter.check("u", "ping", 0).allowed).toBe(true);
        expect(limiter.check("u", "ping", 0).allowed).toBe(true);
        expect(limiter.check("u", "ping", 0).allowed).toBe(true);
        expect(limiter.check("u", "ping", 0)).toEqual({
            allowed: false,
            retryAfterMs: 1000,
        });
        expect(limiter.check("u", "ping", 1000).allowed).toBe(true);
    });

    it("keeps users independent", () => {
        const limiter = new RateLimiter(config);
        for (let i = 0; i < 3; i++) limiter.check("a", "ping", 0);
        expect(limiter.check("a", "ping", 0).allowed).toBe(false);
        expect(limiter.check("b", "ping", 0).allowed).toBe(true);
    });

    it("applies per-command cooldowns without burning tokens", () => {
        const limiter = new RateLimiter(config);
        expect(limiter.check("u", "coinflip", 0).allowed).toBe(true);
        expect(limiter.check("u", "coinflip", 1000)).toEqual({
            allowed: false,
            retryAfterMs: 2000,
        });
        expect(limiter.check("u", "coinflip", 3000).allowed).toBe(true);
    });

    it("sweeps entries that can no longer matter", () => {
        const limiter = new RateLimiter(config);
        limiter.check("u", "coinflip", 0);
        expect(limiter.size).toBe(2);
        limiter.sweep(10_000);
        expect(limiter.size).toBe(0);
    });
});
