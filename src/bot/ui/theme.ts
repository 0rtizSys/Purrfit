import { palette } from "../configs/exporter";

//? One tone per meaning, so a color always tells the user the same thing:
//?  brand    - neutral info (balances, help, leaderboard)
//?  success  - a completed action or a gain
//?  error    - something failed or a loss
//?  cooldown - waiting (cooldowns, rate limits)
//?  crypto   - market data
//?  admin    - server configuration changes
export type EmbedTone = keyof typeof palette;

export const toneColor = (tone: EmbedTone): number => palette[tone];

export const BOT_NAME = "Purrfit";

//? Shared emoji vocabulary so the same concept looks the same everywhere
export const Emoji = {
    wallet: "👛",
    bank: "🏦",
    total: "💰",
    work: "💼",
    cooldown: "🧊",
    success: "✅",
    error: "✖️",
    hint: "💡",
    transfer: "💸",
    tax: "🧾",
    coin: "🪙",
    crypto: "📈",
    chart: "📊",
    buy: "🛒",
    sell: "💱",
    portfolio: "💼",
    settings: "⚙️",
    trophy: "🏆",
    rank: "📍",
    cat: "🐱",
    up: "🟢 ▲",
    down: "🔴 ▼",
} as const;
