/**
 * Simulated crypto prices.
 *
 * Each coin follows a mean-reverting random walk on its log price
 * (an Ornstein-Uhlenbeck process): it moves randomly with the coin's daily
 * volatility, but is gently pulled back toward its base price, so prices
 * feel like a real market without drifting to zero or to infinity over months.
 */

export const TICK_INTERVAL_MS = 5 * 60 * 1000;
export const MEAN_REVERSION_PER_DAY = 0.05;
export const MIN_PRICE_FACTOR = 0.02; // never below 2% of base price
export const MAX_PRICE_FACTOR = 50; // never above 50x base price
export const PRICE_DECIMALS = 6;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Standard normal sample (Box-Muller). */
export function gaussian(random: () => number = Math.random): number {
    let u = 0;
    while (u === 0) u = random();
    const v = random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function nextPrice(
    price: number,
    basePrice: number,
    dailyVolatility: number,
    elapsedMs: number = TICK_INTERVAL_MS,
    shock: number = gaussian(),
): number {
    const dt = Math.max(elapsedMs, 0) / DAY_MS;
    const logPrice = Math.log(price);
    const logBase = Math.log(basePrice);
    const nextLog =
        logPrice +
        MEAN_REVERSION_PER_DAY * (logBase - logPrice) * dt +
        dailyVolatility * Math.sqrt(dt) * shock;

    const bounded = Math.min(
        Math.max(Math.exp(nextLog), basePrice * MIN_PRICE_FACTOR),
        basePrice * MAX_PRICE_FACTOR,
    );
    const factor = 10 ** PRICE_DECIMALS;
    return Math.max(Math.round(bounded * factor) / factor, 1 / factor);
}

/** Percent change between two prices, e.g. 12.5 for +12.5%. */
export function percentChange(from: number, to: number): number {
    if (from <= 0) return 0;
    return ((to - from) / from) * 100;
}
