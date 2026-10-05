import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    MessageFlags,
} from "discord.js";

import {
    sendSimpleEmbed,
    internalErrorEmbed,
} from "../../../Helpers/simplified_embed_builder";

import { getBalance } from "../../../services/database/repository/clients/manager";

import { requireGuild } from "../../../Helpers/require_guild";

import { Command } from "../../types";

import { getEcoSymbol } from "../../../services/database/repository/servers/get_eco_symbol";
import { logger } from "../../../services/logger";

export const getBankBalance: Command = {
    data: new SlashCommandBuilder()
        .setName("bank_balance")
        .setDescription("see your bank balance")
        .addBooleanOption((opt) =>
            opt
                .setName("visibility")
                .setDescription("Other people can see your balance")
                .setRequired(true),
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!(await requireGuild(interaction))) return;
        const isPublic = interaction.options.getBoolean("visibility", true);
        const guildId = interaction.guild!.id;
        const userId = interaction.user.id;
        const symbol = await getEcoSymbol(guildId);
        await interaction.deferReply({
            flags: !isPublic ? MessageFlags.Ephemeral : undefined,
        });
        try {
            const userBal = await getBalance(userId, guildId, "bank");
            await sendSimpleEmbed(interaction, {
                title: "Bank balance 💳",
                description: isPublic
                    ? `Your current balance is \`${symbol}${userBal}\``
                    : `${interaction.user} Your current balance is \`${symbol}${userBal}\``,
                eph: !isPublic,
            });
        } catch (e) {
            logger.error("Error en comando bank_balance", { error: e });
            await internalErrorEmbed(interaction);
        }
    },
};
