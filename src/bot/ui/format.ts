import { Emoji } from "./theme";

//? Formatting helpers for user-facing numbers. Everything money-related goes
//? through here so amounts look the same in every command.

/** `1234567` -> `1,234,567` */
export function formatNumber(value: number): string {
    return value.toLocaleString("en-US");
}

/** Plain money text: `$1,234` / `-$50` (no markdown) */
export function moneyText(symbol: string, amount: number): string {
    const sign = amount < 0 ? "-" : "";
    return `${sign}${symbol}${formatNumber(Math.abs(amount))}`;
}

/** Money as inline code: `` `$1,234` `` */
export function money(symbol: string, amount: number): string {
    return `\`${moneyText(symbol, amount)}\``;
}

/** Signed money as inline code: `` `+$50` `` / `` `-$50` `` */
export function signedMoney(symbol: string, amount: number): string {
    const sign = amount >= 0 ? "+" : "-";
    return `\`${sign}${symbol}${formatNumber(Math.abs(amount))}\``;
}

/** Before/after line: `` `$100` → `$350` `` */
export function moneyChange(
    symbol: string,
    before: number,
    after: number,
): string {
    return `${money(symbol, before)} → ${money(symbol, after)}`;
}

/** `90` -> `1m 30s`, `7200` -> `2h`, `0` -> `0s` */
export function formatDuration(totalSeconds: number): string {
    const seconds = Math.max(0, Math.round(totalSeconds));
    const units: [string, number][] = [
        ["d", 86_400],
        ["h", 3_600],
        ["m", 60],
        ["s", 1],
    ];
    const parts: string[] = [];
    let rest = seconds;
    for (const [label, size] of units) {
        const value = Math.floor(rest / size);
        if (value > 0) parts.push(`${value}${label}`);
        rest %= size;
    }
    return parts.length ? parts.slice(0, 2).join(" ") : "0s";
}

/** Discord relative timestamp ("in 2 minutes"), rendered live by the client */
export function relativeTime(at: Date | number): string {
    const ms = typeof at === "number" ? at : at.getTime();
    return `<t:${Math.floor(ms / 1000)}:R>`;
}

/** `🟢 ▲ 2.31%` / `🔴 ▼ 0.50%` */
export function formatChange(change: number): string {
    const arrow = change >= 0 ? Emoji.up : Emoji.down;
    return `${arrow} ${Math.abs(change).toFixed(2)}%`;
}

/** Big headline line for the main number of an embed */
export function headline(text: string): string {
    return `### ${text}`;
}
