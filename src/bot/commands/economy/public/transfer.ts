import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    MessageFlags,
} from "discord.js";

import { requireGuild } from "../../../Helpers/require_guild";

import { Command } from "../../types";

import {
    isInvalidAmount,
    isSelfTransfer,
    isBotAction,
    MAX_AMOUNT,
    MIN_AMOUNT,
} from "../../../Helpers/validators";

import {
    InsuficientsFundsEmbed,
    internalErrorEmbed,
} from "../../../Helpers/simplified_embed_builder";

import { transferSafe } from "../../../services/database/repository/clients/transaction";

import { getEcoSymbol } from "../../../services/database/repository/servers/get_eco_symbol";

import { sendSimpleEmbed } from "../../../Helpers/simplified_embed_builder";
import { logger } from "../../../services/logger";

export const transferCommand: Command = {
    data: new SlashCommandBuilder()
        .setName("transfer")
        .setDescription("Transfer bank balance to a user")
        .addUserOption((opt) =>
            opt
                .setName("user")
                .setDescription("User to transfer")
                .setRequired(true),
        )
        .addIntegerOption((opt) =>
            opt
                .setName("amount")
                .setDescription("Amount to transfer")
                .setRequired(true)
                .setMinValue(MIN_AMOUNT)
                .setMaxValue(MAX_AMOUNT),
        )
        .addBooleanOption((opt) =>
            opt
                .setName("visibility")
                .setDescription("Others can see your transaction"),
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!(await requireGuild(interaction))) return;
        const guildId = interaction.guild!.id;
        const userId = interaction.user.id;
        const target = interaction.options.getUser("user", true);
        const targetId = target.id;
        const amount = interaction.options.getInteger("amount", true);
        const isPublic = interaction.options.getBoolean("visibility") ?? false;
        await interaction.deferReply({
            flags: !isPublic ? MessageFlags.Ephemeral : undefined,
        });
        try {
            const symbol = await getEcoSymbol(guildId);
            if (await isSelfTransfer(interaction, userId, targetId)) return;
            if (await isBotAction(interaction, target)) return;
            if (await isInvalidAmount(interaction, amount)) return;
            //? The balance check happens inside the transaction, under a row lock
            const result = await transferSafe(
                userId,
                targetId,
                guildId,
                amount,
            );
            if (!result.ok) {
                await InsuficientsFundsEmbed(
                    interaction,
                    result.currentBalance,
                    amount,
                    symbol,
                    "transfer",
                );
                return;
            }
            await sendSimpleEmbed(interaction, {
                title: "Transaction completed 💳",
                description: isPublic
                    ? `${interaction.user} successfully transferred \`${symbol}${amount}\` to <@${targetId}>`
                    : `Successfully transferred \`${symbol}${amount}\` to <@${targetId}>`,
                fields:
                    result.tax > 0
                        ? [
                              {
                                  name: "Received",
                                  value: `\`${symbol}${result.received}\``,
                                  inline: true,
                              },
                              {
                                  name: "Tax",
                                  value: `\`${symbol}${result.tax}\``,
                                  inline: true,
                              },
                          ]
                        : undefined,
            });
        } catch (err) {
            logger.error("Error en comando transfer", { error: err });
            await internalErrorEmbed(interaction);
        }
    },
};
