import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    MessageFlags,
} from "discord.js";

import { Command } from "../../types";

import { requireGuild } from "../../../Helpers/require_guild";

import {
    isInvalidAmount,
    MAX_AMOUNT,
    MIN_AMOUNT,
} from "../../../Helpers/validators";

import { getEcoSymbol } from "../../../services/database/repository/servers/get_eco_symbol";

import {
    InsuficientsFundsEmbed,
    internalErrorEmbed,
    sendSimpleEmbed,
} from "../../../Helpers/simplified_embed_builder";

import { transferInternalSafe } from "../../../services/database/repository/clients/withdraw-transfer";
import { logger } from "../../../services/logger";
import { Emoji } from "../../../ui/theme";
import { headline, moneyText } from "../../../ui/format";

export const withdrawCommand: Command = {
    data: new SlashCommandBuilder()
        .setName("withdraw")
        .setDescription("Withdraw money from your bank")
        .addIntegerOption((opt) =>
            opt
                .setName("amount")
                .setDescription("Amount to withdraw")
                .setRequired(true)
                .setMinValue(MIN_AMOUNT)
                .setMaxValue(MAX_AMOUNT),
        )
        .addBooleanOption((opt) =>
            opt
                .setName("visibility")
                .setDescription(
                    "Other people can see how much money you withdraw",
                ),
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!(await requireGuild(interaction))) return;
        const isPublic = interaction.options.getBoolean("visibility") ?? false;
        const amount = interaction.options.getInteger("amount", true);
        const userId = interaction.user.id;
        const guildId = interaction.guild!.id;
        if (await isInvalidAmount(interaction, amount)) return;
        //? Defer before touching the DB so a slow query cannot expire the interaction
        await interaction.deferReply({
            flags: !isPublic ? MessageFlags.Ephemeral : undefined,
        });
        try {
            const ecoSymbol = await getEcoSymbol(guildId);
            //? The balance check happens inside the transaction, under a row lock
            const result = await transferInternalSafe(
                userId,
                guildId,
                amount,
                "bank",
                "wallet",
            );
            if (!result.ok) {
                await InsuficientsFundsEmbed(
                    interaction,
                    result.currentBalance,
                    amount,
                    ecoSymbol,
                    "withdraw",
                );
                return;
            }
            await sendSimpleEmbed(interaction, {
                author: interaction.user,
                title: `${Emoji.wallet} Withdrawal complete`,
                description: `${headline(moneyText(ecoSymbol, amount))}\nMoved from your ${Emoji.bank} bank to your ${Emoji.wallet} wallet.`,
                tone: "success",
                timestamp: true,
            });
        } catch (e) {
            logger.error("Error en comando withdraw", { error: e });
            await internalErrorEmbed(interaction);
        }
    },
};
