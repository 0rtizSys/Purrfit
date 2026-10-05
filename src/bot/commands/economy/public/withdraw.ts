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
                title: "Withdrawal completed ✅ ",
                description: isPublic
                    ? `Successfully withdrawn \`${ecoSymbol} ${amount}\` from your bank account`
                    : `${interaction.user} You have successfully withdrawn \`${ecoSymbol} ${amount}\` from your bank account`,
            });
        } catch (e) {
            console.log(e);
            await internalErrorEmbed(interaction);
        }
    },
};
