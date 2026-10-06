import { AttachmentBuilder } from "discord.js";

import { cmd } from "../../../framework/context";
import type {
    ArgSpec,
    CommandContext,
    PrefixCommand,
} from "../../../framework/types";
import {
    InsuficientsFundsEmbed,
    sendErrorEmbed,
    sendSimpleEmbed,
} from "../../../Helpers/simplified_embed_builder";
import {
    isInvalidAmount,
    MAX_AMOUNT,
    MIN_AMOUNT,
} from "../../../Helpers/validators";
import { getEcoSymbol } from "../../../services/database/repository/servers/get_eco_symbol";
import {
    buyCrypto,
    CHART_RANGES,
    ChartRange,
    getPortfolio,
    getPriceHistory,
    listMarket,
    normalizeSymbol,
    QUANTITY_PATTERN,
    sellCrypto,
} from "../../../services/database/repository/crypto/market";
import { percentChange } from "../../../services/economy/market_sim";
import {
    formatPrice,
    renderPriceChart,
} from "../../../services/charts/price_chart";
import { Emoji, toneColor } from "../../../ui/theme";
import { formatChange, headline, money, moneyText } from "../../../ui/format";

//? Must match the coins seeded in migrations/002_advanced_economy.sql
const COIN_CHOICES = ["PURR", "MEOW", "WSK", "NIP", "TUNA"] as const;

const RANGE_CHOICES = Object.keys(CHART_RANGES) as ChartRange[];

const COIN_ARG: ArgSpec = {
    name: "coin",
    kind: "choice",
    description:
        "Coin (Purrcoin PURR, Meowthereum MEOW, Whisker Token WSK, Catnip NIP, Tuna Stable TUNA)",
    choices: COIN_CHOICES,
};

function trimQuantity(quantity: string): string {
    return quantity.includes(".") ? quantity.replace(/\.?0+$/, "") : quantity;
}

const unknownCoin = (ctx: CommandContext) => ({
    title: `${Emoji.error} Unknown coin`,
    description: "That coin is not listed on the market.",
    hint: `Use ${cmd(ctx, "crypto market")} to see the available coins.`,
    tone: "error" as const,
});

const price = (symbol: string, value: number) =>
    `\`${symbol}${formatPrice(value)}\``;

async function market(ctx: CommandContext) {
    await ctx.defer();
    const assets = await listMarket();
    const symbol = await getEcoSymbol(ctx.guildId);
    await sendSimpleEmbed(ctx, {
        title: `${Emoji.crypto} Crypto market`,
        description:
            "Simulated coins. Prices move every 5 minutes and are the same in every server.",
        fields: assets.map((a) => ({
            name: `${a.name} · ${a.symbol}`,
            value: `**${symbol}${formatPrice(a.price)}**\n${formatChange(percentChange(a.price24hAgo, a.price))} \`24h\``,
            inline: true,
        })),
        hint: `See the trend with ${cmd(ctx, "crypto chart <coin>")}, trade with ${cmd(ctx, "crypto buy <coin> <amount>")}.`,
        tone: "crypto",
        timestamp: true,
    });
}

async function chart(ctx: CommandContext) {
    const coin = normalizeSymbol(ctx.args.string("coin"));
    const range = (ctx.args.stringOpt("range") ?? "24h") as ChartRange;
    if (!(range in CHART_RANGES)) {
        await sendErrorEmbed(
            ctx,
            "Invalid range",
            "Choose `1h`, `24h`, `7d` or `30d`.",
        );
        return;
    }
    await ctx.defer();
    const history = await getPriceHistory(coin, range);
    if (!history) {
        await sendSimpleEmbed(ctx, unknownCoin(ctx));
        return;
    }
    const first = history.points[0];
    const last = history.points[history.points.length - 1];
    const symbol = await getEcoSymbol(ctx.guildId);
    const png = renderPriceChart(
        `${history.name} (${coin}) · ${range}`,
        history.points,
    );
    const file = new AttachmentBuilder(png, { name: "chart.png" });
    const change = percentChange(first.price, last.price);
    await sendSimpleEmbed(ctx, {
        title: `${Emoji.chart} ${history.name} · ${coin}`,
        description: `${headline(`${symbol}${formatPrice(last.price)}`)}\n${formatChange(change)} in the last \`${range}\``,
        image: "attachment://chart.png",
        files: [file],
        tone: "crypto",
        //? The embed takes the same green/red as the chart line
        color: toneColor(change >= 0 ? "success" : "error"),
        hint: "Simulated market · chart times in UTC",
    });
}

async function buy(ctx: CommandContext) {
    const coin = normalizeSymbol(ctx.args.string("coin"));
    const amount = ctx.args.integer("amount");
    if (await isInvalidAmount(ctx, amount)) return;
    await ctx.defer();

    const guildId = ctx.guildId;
    const symbol = await getEcoSymbol(guildId);
    const result = await buyCrypto(ctx.user.id, guildId, coin, amount);
    if (!result.ok) {
        if (result.reason === "insufficient_funds") {
            await InsuficientsFundsEmbed(
                ctx,
                result.currentBalance,
                amount,
                symbol,
                "spend",
            );
        } else if (result.reason === "too_small") {
            await sendErrorEmbed(
                ctx,
                "Amount too small",
                "That amount does not buy any coin at the current price.",
                "Try a bigger amount.",
            );
        } else {
            await sendSimpleEmbed(ctx, unknownCoin(ctx));
        }
        return;
    }
    await sendSimpleEmbed(ctx, {
        author: ctx.user,
        title: `${Emoji.buy} Purchase complete`,
        description: `${headline(`${trimQuantity(result.quantity)} ${coin}`)}\nBought for ${money(symbol, amount)}.`,
        fields: [
            {
                name: "Price",
                value: price(symbol, result.price),
                inline: true,
            },
            {
                name: `${Emoji.wallet} Wallet`,
                value: money(symbol, result.newWallet),
                inline: true,
            },
        ],
        tone: "success",
        timestamp: true,
    });
}

async function sell(ctx: CommandContext) {
    const coin = normalizeSymbol(ctx.args.string("coin"));
    const rawQuantity = ctx.args.stringOpt("quantity")?.trim() ?? null;
    if (rawQuantity !== null && !QUANTITY_PATTERN.test(rawQuantity)) {
        await sendErrorEmbed(
            ctx,
            "Invalid quantity",
            "Use a positive number with up to 8 decimals, like `0.5` or `12`.",
            "Leave it empty to sell everything.",
        );
        return;
    }
    await ctx.defer();

    const guildId = ctx.guildId;
    const symbol = await getEcoSymbol(guildId);
    const result = await sellCrypto(ctx.user.id, guildId, coin, rawQuantity);
    if (!result.ok) {
        const messages = {
            unknown_coin: unknownCoin(ctx).description,
            no_holdings: `You don't own any ${coin}. Check ${cmd(ctx, "crypto portfolio")}.`,
            insufficient_holdings: `You only own \`${"held" in result ? trimQuantity(result.held) : "0"} ${coin}\`.`,
            too_small:
                "That quantity is worth less than 1 at the current price.",
        };
        await sendErrorEmbed(ctx, "Sale failed", messages[result.reason]);
        return;
    }
    const fields = [
        {
            name: "Price",
            value: price(symbol, result.price),
            inline: true,
        },
        {
            name: "Received",
            value: money(symbol, result.proceeds - result.tax),
            inline: true,
        },
        {
            name: `${Emoji.wallet} Wallet`,
            value: money(symbol, result.newWallet),
            inline: true,
        },
    ];
    if (result.tax > 0)
        fields.splice(2, 0, {
            name: `${Emoji.tax} Tax`,
            value: money(symbol, result.tax),
            inline: true,
        });
    await sendSimpleEmbed(ctx, {
        author: ctx.user,
        title: `${Emoji.sell} Sale complete`,
        description: `${headline(`${trimQuantity(result.quantity)} ${coin}`)}\nSold for ${money(symbol, result.proceeds)}.`,
        fields,
        tone: "success",
        timestamp: true,
    });
}

async function portfolio(ctx: CommandContext) {
    await ctx.defer();
    const guildId = ctx.guildId;
    const [holdings, symbol] = await Promise.all([
        getPortfolio(ctx.user.id, guildId),
        getEcoSymbol(guildId),
    ]);
    if (holdings.length === 0) {
        await sendSimpleEmbed(ctx, {
            author: ctx.user,
            title: `${Emoji.portfolio} Portfolio`,
            description: "You don't own any coins yet.",
            hint: `Check prices with ${cmd(ctx, "crypto market")} and buy with ${cmd(ctx, "crypto buy <coin> <amount>")}.`,
            tone: "crypto",
        });
        return;
    }
    const totalValue = holdings.reduce((sum, h) => sum + h.value, 0);
    const totalCost = holdings.reduce((sum, h) => sum + h.costBasis, 0);
    const profit = totalValue - totalCost;
    await sendSimpleEmbed(ctx, {
        author: ctx.user,
        title: `${Emoji.portfolio} Portfolio`,
        description: `${headline(moneyText(symbol, totalValue))}\n${formatChange(percentChange(totalCost, totalValue))} · ${profit >= 0 ? "+" : "-"}${moneyText(symbol, Math.abs(profit))} vs. what you paid`,
        fields: holdings.map((h) => ({
            name: `${h.name} · ${h.symbol}`,
            value: `**${trimQuantity(h.quantity)}** ${h.symbol}\nWorth ${money(symbol, h.value)}\n-# Paid ${moneyText(symbol, h.costBasis)} · ${formatChange(percentChange(h.costBasis, h.value))}`,
            inline: true,
        })),
        tone: "crypto",
    });
}

export const cryptoCommand: PrefixCommand = {
    name: "crypto",
    aliases: ["c"],
    description: "Trade simulated cryptocurrencies",
    subcommands: [
        {
            name: "market",
            aliases: ["m"],
            description: "See current coin prices",
            execute: market,
        },
        {
            name: "chart",
            aliases: ["ch"],
            description: "See a price chart for a coin",
            args: [
                COIN_ARG,
                {
                    name: "range",
                    kind: "choice",
                    description: "Time range (default 24h)",
                    choices: RANGE_CHOICES,
                    optional: true,
                },
            ],
            execute: chart,
        },
        {
            name: "buy",
            aliases: ["b"],
            description: "Buy a coin with money from your wallet",
            args: [
                COIN_ARG,
                {
                    name: "amount",
                    kind: "amount",
                    description: "How much money to spend",
                    min: MIN_AMOUNT,
                    max: MAX_AMOUNT,
                },
            ],
            execute: buy,
        },
        {
            name: "sell",
            aliases: ["s"],
            description: "Sell a coin into your wallet",
            args: [
                COIN_ARG,
                {
                    name: "quantity",
                    kind: "word",
                    description: "How many coins to sell (empty = all)",
                    optional: true,
                },
            ],
            execute: sell,
        },
        {
            name: "portfolio",
            aliases: ["pf", "port"],
            description: "See the coins you own",
            execute: portfolio,
        },
    ],
};
