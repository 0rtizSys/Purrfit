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
import { Emoji } from "../../../ui/theme";
import { headline, money, moneyText } from "../../../ui/format";

export const transferCommand: Command = {
    data: new SlashCommandBuilder()
        .setName("transfer")
        .setDescription("Send money from your bank to another member")
        .addUserOption((opt) =>
            opt
                .setName("user")
                .setDescription("Member who receives the money")
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
        //? Input checks need no DB, so they run before the defer and their
        //? errors are always private
        if (await isSelfTransfer(interaction, userId, targetId)) return;
        if (await isBotAction(interaction, target)) return;
        if (await isInvalidAmount(interaction, amount)) return;
        await interaction.deferReply({
            flags: !isPublic ? MessageFlags.Ephemeral : undefined,
        });
        try {
            const symbol = await getEcoSymbol(guildId);
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
            const fields = [
                { name: "From", value: `${interaction.user}`, inline: true },
                { name: "To", value: `${target}`, inline: true },
            ];
            if (result.tax > 0) {
                fields.push(
                    {
                        name: `${Emoji.tax} Tax`,
                        value: money(symbol, result.tax),
                        inline: true,
                    },
                    {
                        name: "Received",
                        value: money(symbol, result.received),
                        inline: true,
                    },
                );
            }
            await sendSimpleEmbed(interaction, {
                author: interaction.user,
                title: `${Emoji.transfer} Transfer complete`,
                description: headline(moneyText(symbol, amount)),
                fields,
                tone: "success",
                timestamp: true,
            });
        } catch (err) {
            logger.error("Error en comando transfer", { error: err });
            await internalErrorEmbed(interaction);
        }
    },
};
