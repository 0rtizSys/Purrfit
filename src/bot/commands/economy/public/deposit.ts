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

export const depositCommand: Command = {
    data: new SlashCommandBuilder()
        .setName("deposit")
        .setDescription("Deposit money to your bank")
        .addIntegerOption((opt) =>
            opt
                .setName("amount")
                .setDescription("Amount to deposit")
                .setRequired(true)
                .setMinValue(MIN_AMOUNT)
                .setMaxValue(MAX_AMOUNT),
        )
        .addBooleanOption((opt) =>
            opt
                .setName("visibility")
                .setDescription(
                    "Other people can see how much money you deposit",
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
                "wallet",
                "bank",
            );
            if (!result.ok) {
                await InsuficientsFundsEmbed(
                    interaction,
                    result.currentBalance,
                    amount,
                    ecoSymbol,
                    "deposit",
                );
                return;
            }
            await sendSimpleEmbed(interaction, {
                title: "Deposit completed ✅ ",
                description: isPublic
                    ? `Successfully deposit \`${ecoSymbol} ${amount}\` from your wallet`
                    : `${interaction.user} You have successfully deposit \`${ecoSymbol} ${amount}\` from your wallet`,
            });
        } catch (e) {
            console.log(e);
            await internalErrorEmbed(interaction);
        }
    },
};
