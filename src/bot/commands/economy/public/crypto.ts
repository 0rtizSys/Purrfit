import {
    AttachmentBuilder,
    ChatInputCommandInteraction,
    MessageFlags,
    SlashCommandBuilder,
} from "discord.js";

import { Command } from "../../types";
import { requireGuild } from "../../../Helpers/require_guild";
import {
    internalErrorEmbed,
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
import { logger } from "../../../services/logger";
import { Emoji, toneColor } from "../../../ui/theme";
import { formatChange, headline, money, moneyText } from "../../../ui/format";

//? Must match the coins seeded in migrations/002_advanced_economy.sql
const COIN_CHOICES = [
    { name: "Purrcoin (PURR)", value: "PURR" },
    { name: "Meowthereum (MEOW)", value: "MEOW" },
    { name: "Whisker Token (WSK)", value: "WSK" },
    { name: "Catnip (NIP)", value: "NIP" },
    { name: "Tuna Stable (TUNA)", value: "TUNA" },
];

const RANGE_CHOICES = (Object.keys(CHART_RANGES) as ChartRange[]).map((r) => ({
    name: r,
    value: r,
}));

function trimQuantity(quantity: string): string {
    return quantity.includes(".") ? quantity.replace(/\.?0+$/, "") : quantity;
}

const UNKNOWN_COIN = {
    title: `${Emoji.error} Unknown coin`,
    description: "That coin is not listed on the market.",
    hint: "Use `/crypto market` to see the available coins.",
    tone: "error" as const,
};

const price = (symbol: string, value: number) =>
    `\`${symbol}${formatPrice(value)}\``;

async function market(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();
    const assets = await listMarket();
    const symbol = await getEcoSymbol(interaction.guild!.id);
    await sendSimpleEmbed(interaction, {
        title: `${Emoji.crypto} Crypto market`,
        description:
            "Simulated coins. Prices move every 5 minutes and are the same in every server.",
        fields: assets.map((a) => ({
            name: `${a.name} · ${a.symbol}`,
            value: `**${symbol}${formatPrice(a.price)}**\n${formatChange(percentChange(a.price24hAgo, a.price))} \`24h\``,
            inline: true,
        })),
        hint: "See the trend with `/crypto chart`, trade with `/crypto buy`.",
        tone: "crypto",
        timestamp: true,
    });
}

async function chart(interaction: ChatInputCommandInteraction) {
    const coin = normalizeSymbol(interaction.options.getString("coin", true));
    const range = (interaction.options.getString("range") ??
        "24h") as ChartRange;
    if (!(range in CHART_RANGES)) {
        await sendErrorEmbed(
            interaction,
            "Invalid range",
            "Choose `1h`, `24h`, `7d` or `30d`.",
        );
        return;
    }
    await interaction.deferReply();
    const history = await getPriceHistory(coin, range);
    if (!history) {
        await sendSimpleEmbed(interaction, UNKNOWN_COIN);
        return;
    }
    const first = history.points[0];
    const last = history.points[history.points.length - 1];
    const symbol = await getEcoSymbol(interaction.guild!.id);
    const png = renderPriceChart(
        `${history.name} (${coin}) · ${range}`,
        history.points,
    );
    const file = new AttachmentBuilder(png, { name: "chart.png" });
    const change = percentChange(first.price, last.price);
    await sendSimpleEmbed(interaction, {
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

async function buy(
    interaction: ChatInputCommandInteraction,
    isPublic: boolean,
) {
    const coin = normalizeSymbol(interaction.options.getString("coin", true));
    const amount = interaction.options.getInteger("amount", true);
    if (await isInvalidAmount(interaction, amount)) return;
    await interaction.deferReply({
        flags: isPublic ? undefined : MessageFlags.Ephemeral,
    });

    const guildId = interaction.guild!.id;
    const symbol = await getEcoSymbol(guildId);
    const result = await buyCrypto(interaction.user.id, guildId, coin, amount);
    if (!result.ok) {
        if (result.reason === "insufficient_funds") {
            await InsuficientsFundsEmbed(
                interaction,
                result.currentBalance,
                amount,
                symbol,
                "spend",
            );
        } else if (result.reason === "too_small") {
            await sendErrorEmbed(
                interaction,
                "Amount too small",
                "That amount does not buy any coin at the current price.",
                "Try a bigger amount.",
            );
        } else {
            await sendSimpleEmbed(interaction, UNKNOWN_COIN);
        }
        return;
    }
    await sendSimpleEmbed(interaction, {
        author: interaction.user,
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

async function sell(
    interaction: ChatInputCommandInteraction,
    isPublic: boolean,
) {
    const coin = normalizeSymbol(interaction.options.getString("coin", true));
    const rawQuantity =
        interaction.options.getString("quantity")?.trim() ?? null;
    if (rawQuantity !== null && !QUANTITY_PATTERN.test(rawQuantity)) {
        await sendErrorEmbed(
            interaction,
            "Invalid quantity",
            "Use a positive number with up to 8 decimals, like `0.5` or `12`.",
            "Leave it empty to sell everything.",
        );
        return;
    }
    await interaction.deferReply({
        flags: isPublic ? undefined : MessageFlags.Ephemeral,
    });

    const guildId = interaction.guild!.id;
    const symbol = await getEcoSymbol(guildId);
    const result = await sellCrypto(
        interaction.user.id,
        guildId,
        coin,
        rawQuantity,
    );
    if (!result.ok) {
        const messages = {
            unknown_coin: UNKNOWN_COIN.description,
            no_holdings: `You don't own any ${coin}. Check \`/crypto portfolio\`.`,
            insufficient_holdings: `You only own \`${"held" in result ? trimQuantity(result.held) : "0"} ${coin}\`.`,
            too_small:
                "That quantity is worth less than 1 at the current price.",
        };
        await sendErrorEmbed(
            interaction,
            "Sale failed",
            messages[result.reason],
        );
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
    await sendSimpleEmbed(interaction, {
        author: interaction.user,
        title: `${Emoji.sell} Sale complete`,
        description: `${headline(`${trimQuantity(result.quantity)} ${coin}`)}\nSold for ${money(symbol, result.proceeds)}.`,
        fields,
        tone: "success",
        timestamp: true,
    });
}

async function portfolio(
    interaction: ChatInputCommandInteraction,
    isPublic: boolean,
) {
    await interaction.deferReply({
        flags: isPublic ? undefined : MessageFlags.Ephemeral,
    });
    const guildId = interaction.guild!.id;
    const [holdings, symbol] = await Promise.all([
        getPortfolio(interaction.user.id, guildId),
        getEcoSymbol(guildId),
    ]);
    if (holdings.length === 0) {
        await sendSimpleEmbed(interaction, {
            author: interaction.user,
            title: `${Emoji.portfolio} Portfolio`,
            description: "You don't own any coins yet.",
            hint: "Check prices with `/crypto market` and buy with `/crypto buy`.",
            tone: "crypto",
        });
        return;
    }
    const totalValue = holdings.reduce((sum, h) => sum + h.value, 0);
    const totalCost = holdings.reduce((sum, h) => sum + h.costBasis, 0);
    const profit = totalValue - totalCost;
    await sendSimpleEmbed(interaction, {
        author: interaction.user,
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

export const cryptoCommand: Command = {
    data: new SlashCommandBuilder()
        .setName("crypto")
        .setDescription("Trade simulated cryptocurrencies")
        .addSubcommand((sub) =>
            sub.setName("market").setDescription("See current coin prices"),
        )
        .addSubcommand((sub) =>
            sub
                .setName("chart")
                .setDescription("See a price chart for a coin")
                .addStringOption((opt) =>
                    opt
                        .setName("coin")
                        .setDescription("Coin")
                        .setRequired(true)
                        .addChoices(...COIN_CHOICES),
                )
                .addStringOption((opt) =>
                    opt
                        .setName("range")
                        .setDescription("Time range (default 24h)")
                        .addChoices(...RANGE_CHOICES),
                ),
        )
        .addSubcommand((sub) =>
            sub
                .setName("buy")
                .setDescription("Buy a coin with money from your wallet")
                .addStringOption((opt) =>
                    opt
                        .setName("coin")
                        .setDescription("Coin")
                        .setRequired(true)
                        .addChoices(...COIN_CHOICES),
                )
                .addIntegerOption((opt) =>
                    opt
                        .setName("amount")
                        .setDescription("How much money to spend")
                        .setRequired(true)
                        .setMinValue(MIN_AMOUNT)
                        .setMaxValue(MAX_AMOUNT),
                )
                .addBooleanOption((opt) =>
                    opt
                        .setName("visibility")
                        .setDescription("Other people can see it"),
                ),
        )
        .addSubcommand((sub) =>
            sub
                .setName("sell")
                .setDescription("Sell a coin into your wallet")
                .addStringOption((opt) =>
                    opt
                        .setName("coin")
                        .setDescription("Coin")
                        .setRequired(true)
                        .addChoices(...COIN_CHOICES),
                )
                .addStringOption((opt) =>
                    opt
                        .setName("quantity")
                        .setDescription("How many coins to sell (empty = all)")
                        .setMaxLength(32),
                )
                .addBooleanOption((opt) =>
                    opt
                        .setName("visibility")
                        .setDescription("Other people can see it"),
                ),
        )
        .addSubcommand((sub) =>
            sub
                .setName("portfolio")
                .setDescription("See the coins you own")
                .addBooleanOption((opt) =>
                    opt
                        .setName("visibility")
                        .setDescription("Other people can see it"),
                ),
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!(await requireGuild(interaction))) return;
        const isPublic = interaction.options.getBoolean("visibility") ?? false;
        const sub = interaction.options.getSubcommand();
        try {
            if (sub === "market") await market(interaction);
            else if (sub === "chart") await chart(interaction);
            else if (sub === "buy") await buy(interaction, isPublic);
            else if (sub === "sell") await sell(interaction, isPublic);
            else if (sub === "portfolio")
                await portfolio(interaction, isPublic);
        } catch (error) {
            logger.error("Error en comando crypto", { sub, error });
            await internalErrorEmbed(interaction);
        }
    },
};
