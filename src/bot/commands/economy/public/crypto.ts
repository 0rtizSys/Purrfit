import {
    AttachmentBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
    MessageFlags,
    SlashCommandBuilder,
} from "discord.js";

import { Command } from "../../types";
import { requireGuild } from "../../../Helpers/require_guild";
import {
    internalErrorEmbed,
    InsuficientsFundsEmbed,
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
import { embColor } from "../../../configs/exporter";
import { logger } from "../../../services/logger";

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

function formatChange(change: number): string {
    const arrow = change >= 0 ? "🟢 ▲" : "🔴 ▼";
    return `${arrow} ${Math.abs(change).toFixed(2)}%`;
}

function trimQuantity(quantity: string): string {
    return quantity.includes(".") ? quantity.replace(/\.?0+$/, "") : quantity;
}

const UNKNOWN_COIN = {
    title: "✖️ Unknown coin",
    description: "Use `/crypto market` to see the available coins.",
    thumType: "error" as const,
};

async function market(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();
    const assets = await listMarket();
    const symbol = await getEcoSymbol(interaction.guild!.id);
    await sendSimpleEmbed(interaction, {
        title: "📈 Purrfit Crypto Market",
        description:
            "Simulated coins: prices move every 5 minutes and are the same in every server.",
        fields: assets.map((a) => ({
            name: `${a.name} (${a.symbol})`,
            value: `\`${symbol}${formatPrice(a.price)}\`\n24h: ${formatChange(percentChange(a.price24hAgo, a.price))}`,
            inline: true,
        })),
    });
}

async function chart(interaction: ChatInputCommandInteraction) {
    const coin = normalizeSymbol(interaction.options.getString("coin", true));
    const range = (interaction.options.getString("range") ??
        "24h") as ChartRange;
    if (!(range in CHART_RANGES)) {
        await sendSimpleEmbed(interaction, {
            title: "✖️ Invalid range",
            description: "Choose `1h`, `24h`, `7d` or `30d`.",
            thumType: "error",
            eph: true,
        });
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
    const embed = new EmbedBuilder()
        .setColor(embColor)
        .setTitle(`📊 ${history.name} (${coin})`)
        .setDescription(
            `Price: \`${symbol}${formatPrice(last.price)}\`\n${range}: ${formatChange(percentChange(first.price, last.price))}`,
        )
        .setImage("attachment://chart.png")
        .setFooter({ text: "Simulated market · times in UTC" });
    await interaction.editReply({ embeds: [embed], files: [file] });
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
            await sendSimpleEmbed(interaction, {
                title: "✖️ Amount too small",
                description:
                    "That amount does not buy any coin at the current price.",
                thumType: "error",
            });
        } else {
            await sendSimpleEmbed(interaction, UNKNOWN_COIN);
        }
        return;
    }
    await sendSimpleEmbed(interaction, {
        title: "🛒 Purchase completed",
        description: `${interaction.user} bought \`${trimQuantity(result.quantity)} ${coin}\` for \`${symbol}${amount}\`.`,
        thumType: "success",
        fields: [
            {
                name: "Price",
                value: `\`${symbol}${formatPrice(result.price)}\``,
                inline: true,
            },
            {
                name: "Wallet",
                value: `\`${symbol}${result.newWallet}\``,
                inline: true,
            },
        ],
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
        await sendSimpleEmbed(interaction, {
            title: "✖️ Invalid quantity",
            description:
                "Use a positive number with up to 8 decimals, like `0.5` or `12`. Leave it empty to sell everything.",
            thumType: "error",
            eph: true,
        });
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
            no_holdings: `You don't own any ${coin}.`,
            insufficient_holdings: `You only own \`${"held" in result ? trimQuantity(result.held) : "0"} ${coin}\`.`,
            too_small:
                "That quantity is worth less than 1 at the current price.",
        };
        await sendSimpleEmbed(interaction, {
            title: "✖️ Sale failed",
            description: messages[result.reason],
            thumType: "error",
        });
        return;
    }
    const fields = [
        {
            name: "Price",
            value: `\`${symbol}${formatPrice(result.price)}\``,
            inline: true,
        },
        {
            name: "Received",
            value: `\`${symbol}${result.proceeds - result.tax}\``,
            inline: true,
        },
        {
            name: "Wallet",
            value: `\`${symbol}${result.newWallet}\``,
            inline: true,
        },
    ];
    if (result.tax > 0)
        fields.splice(2, 0, {
            name: "Tax",
            value: `\`${symbol}${result.tax}\``,
            inline: true,
        });
    await sendSimpleEmbed(interaction, {
        title: "💱 Sale completed",
        description: `${interaction.user} sold \`${trimQuantity(result.quantity)} ${coin}\` for \`${symbol}${result.proceeds}\`.`,
        thumType: "success",
        fields,
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
            title: "💼 Portfolio",
            description: "You don't own any coins yet. Try `/crypto buy`.",
        });
        return;
    }
    const totalValue = holdings.reduce((sum, h) => sum + h.value, 0);
    const totalCost = holdings.reduce((sum, h) => sum + h.costBasis, 0);
    await sendSimpleEmbed(interaction, {
        title: `💼 ${interaction.user.username}'s portfolio`,
        description: `Value: \`${symbol}${totalValue}\` (${formatChange(percentChange(totalCost, totalValue))} vs. cost)`,
        fields: holdings.map((h) => ({
            name: `${h.name} (${h.symbol})`,
            value: `\`${trimQuantity(h.quantity)}\` · \`${symbol}${h.value}\`\nCost: \`${symbol}${h.costBasis}\``,
            inline: true,
        })),
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
