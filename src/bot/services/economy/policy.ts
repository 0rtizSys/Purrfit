/**
 * Pure economy rules shared by commands, repositories and tests.
 */

export const BPS_DENOMINATOR = 10_000;
export const MAX_TAX_BPS = 5_000; // 50%
export const MAX_INTEREST_BPS = 500; // 5% per day
export const DEFAULT_TAX_BPS = 0;
export const DEFAULT_INTEREST_BPS = 10; // 0.1% per day
//? Caps how much a single account can earn in interest per day, so parking
//? huge balances (or depositing right before the payout) cannot print money
export const MAX_DAILY_INTEREST = 10_000;

/** Tax owed on `amount`, rounded down so it never exceeds the rate. */
export function computeTax(amount: number, taxBps: number): number {
    if (taxBps <= 0 || amount <= 0) return 0;
    return Math.floor((amount * taxBps) / BPS_DENOMINATOR);
}

/** Converts a percentage typed by an admin (e.g. 2.5) to basis points (250). */
export function percentToBps(percent: number): number {
    return Math.round(percent * 100);
}

export function formatBps(bps: number): string {
    return `${(bps / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;
}
