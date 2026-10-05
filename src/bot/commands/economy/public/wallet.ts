import {
    SlashCommandBuilder,
    SlashCommandOptionsOnlyBuilder,
    ChatInputCommandInteraction,
    MessageFlags,
} from "discord.js";
import { getBalance } from "../../../services/database/repository/clients/manager";

import {
    internalErrorEmbed,
    sendSimpleEmbed,
} from "../../../Helpers/simplified_embed_builder";

import { getEcoSymbol } from "../../../services/database/repository/servers/get_eco_symbol";

import { requireGuild } from "../../../Helpers/require_guild";
import { logger } from "../../../services/logger";

export interface Command {
    data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
    execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

export const getWalletBalance: Command = {
    data: new SlashCommandBuilder()
        .setName("wallet_balance")
        .setDescription("see your wallet balance")
        .addBooleanOption((option) =>
            option
                .setName("visibility")
                .setDescription("Other people can see your balance")
                .setRequired(true),
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!(await requireGuild(interaction))) return;
        const isPublic = interaction.options.getBoolean("visibility", true);
        const userId = interaction.user.id;
        const guildId = interaction.guild!.id;
        await interaction.deferReply({
            flags: !isPublic ? MessageFlags.Ephemeral : undefined,
        }); //^ Here we defer the message
        try {
            const symbol = await getEcoSymbol(guildId);
            const userBal = await getBalance(userId, guildId, "wallet");
            await sendSimpleEmbed(interaction, {
                title: "Wallet Balance 💵",
                description: isPublic
                    ? `Your current balance is \`${symbol}${userBal}\``
                    : `${interaction.user} Your current balance is \`${symbol}${userBal}\``,
                eph: !isPublic,
            });
        } catch (e) {
            logger.error("Error en comando wallet_balance", { error: e });
            await internalErrorEmbed(interaction);
        }
    },
};
