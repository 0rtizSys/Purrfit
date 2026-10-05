import {
    ChatInputCommandInteraction,
    MessageFlags,
    SlashCommandBuilder,
} from "discord.js";

import { Command } from "../types";
import { requireGuild } from "../../Helpers/require_guild";
import {
    isInvalidAmount,
    MAX_AMOUNT,
    MIN_AMOUNT,
} from "../../Helpers/validators";
import {
    internalErrorEmbed,
    InsuficientsFundsEmbed,
    sendErrorEmbed,
    sendSimpleEmbed,
} from "../../Helpers/simplified_embed_builder";
import { getEcoSymbol } from "../../services/database/repository/servers/get_eco_symbol";
import { applyWalletWager } from "../../services/database/repository/clients/wager";
import {
    CoinSide,
    isCoinSide,
    settleCoinFlip,
} from "../../services/games/coin_flip";
import { logger } from "../../services/logger";
import { Emoji, toneColor } from "../../ui/theme";
import { headline, money, moneyChange, moneyText } from "../../ui/format";

const DEFAULT_BET = 50;

function formatSide(side: CoinSide): string {
    return side === "heads" ? "Heads" : "Tails";
}

export const coinFlipCommand: Command = {
    data: new SlashCommandBuilder()
        .setName("coinflip")
        .setDescription("Bet wallet money by flipping a coin")
        .addStringOption((opt) =>
            opt
                .setName("choice")
                .setDescription("Choose one side of the coin")
                .setRequired(true)
                .addChoices(
                    { name: "Heads", value: "heads" },
                    { name: "Tails", value: "tails" },
                ),
        )
        .addIntegerOption((opt) =>
            opt
                .setName("amount")
                .setDescription(
                    `Amount to bet from your wallet (default ${DEFAULT_BET})`,
                )
                .setMinValue(MIN_AMOUNT)
                .setMaxValue(MAX_AMOUNT),
        )
        .addBooleanOption((opt) =>
            opt
                .setName("visibility")
                .setDescription("Other people can see your flip"),
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!(await requireGuild(interaction))) return;

        const guildId = interaction.guild!.id;
        const userId = interaction.user.id;
        const choiceOption = interaction.options.getString("choice", true);
        const amount = interaction.options.getInteger("amount") ?? DEFAULT_BET;
        const isPublic = interaction.options.getBoolean("visibility") ?? false;

        if (!isCoinSide(choiceOption)) {
            await sendErrorEmbed(
                interaction,
                "Invalid coin side",
                "Choose `Heads` or `Tails` to play coinflip.",
            );
            return;
        }

        if (await isInvalidAmount(interaction, amount)) return;

        await interaction.deferReply({
            flags: !isPublic ? MessageFlags.Ephemeral : undefined,
        });

        try {
            const symbol = await getEcoSymbol(guildId);
            const outcome = settleCoinFlip(choiceOption, amount);
            const wager = await applyWalletWager(
                userId,
                guildId,
                outcome.amount,
                outcome.balanceDelta,
            );

            if (!wager.ok) {
                await InsuficientsFundsEmbed(
                    interaction,
                    wager.currentBalance,
                    amount,
                    symbol,
                    "spend",
                );
                return;
            }

            const delta = outcome.won ? outcome.amount : -outcome.amount;
            await sendSimpleEmbed(interaction, {
                author: interaction.user,
                title: outcome.won
                    ? `${Emoji.coin} You won!`
                    : `${Emoji.coin} You lost`,
                description: `You picked **${formatSide(outcome.choice)}** · the coin landed on **${formatSide(outcome.result)}**\n${headline(`${delta >= 0 ? "+" : "-"}${moneyText(symbol, Math.abs(delta))}`)}`,
                tone: "success",
                //? A lost bet is a normal result, not an error: only the color
                //? changes, so it stays public and keeps the footer
                color: outcome.won ? undefined : toneColor("error"),
                fields: [
                    {
                        name: "Bet",
                        value: money(symbol, outcome.amount),
                        inline: true,
                    },
                    {
                        name: `${Emoji.wallet} Wallet`,
                        value: moneyChange(
                            symbol,
                            wager.previousBalance,
                            wager.newBalance,
                        ),
                        inline: true,
                    },
                ],
            });
        } catch (error) {
            logger.error("Error en comando coinflip", { error: error });
            await internalErrorEmbed(interaction);
        }
    },
};
