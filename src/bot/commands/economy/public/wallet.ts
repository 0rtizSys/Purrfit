import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    MessageFlags,
} from "discord.js";

import { internalErrorEmbed } from "../../../Helpers/simplified_embed_builder";
import { sendBalanceEmbed } from "../../../Helpers/balance_embed";
import { requireGuild } from "../../../Helpers/require_guild";
import { Command } from "../../types";
import { logger } from "../../../services/logger";

export const getWalletBalance: Command = {
    data: new SlashCommandBuilder()
        .setName("wallet_balance")
        .setDescription("See your wallet balance")
        .addBooleanOption((option) =>
            option
                .setName("visibility")
                .setDescription("Other people can see your balance"),
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!(await requireGuild(interaction))) return;
        const isPublic = interaction.options.getBoolean("visibility") ?? false;
        await interaction.deferReply({
            flags: !isPublic ? MessageFlags.Ephemeral : undefined,
        }); //^ Here we defer the message
        try {
            await sendBalanceEmbed(interaction, "wallet");
        } catch (e) {
            logger.error("Error en comando wallet_balance", { error: e });
            await internalErrorEmbed(interaction);
        }
    },
};
