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

export const getBankBalance: Command = {
    data: new SlashCommandBuilder()
        .setName("bank_balance")
        .setDescription("See your bank balance")
        .addBooleanOption((opt) =>
            opt
                .setName("visibility")
                .setDescription("Other people can see your balance"),
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!(await requireGuild(interaction))) return;
        const isPublic = interaction.options.getBoolean("visibility") ?? false;
        //? Defer before touching the DB so a slow query cannot expire the interaction
        await interaction.deferReply({
            flags: !isPublic ? MessageFlags.Ephemeral : undefined,
        });
        try {
            await sendBalanceEmbed(interaction, "bank");
        } catch (e) {
            logger.error("Error en comando bank_balance", { error: e });
            await internalErrorEmbed(interaction);
        }
    },
};
