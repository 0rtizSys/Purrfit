import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

import { Command } from "../types";
import {
    internalErrorEmbed,
    sendSimpleEmbed,
} from "../../Helpers/simplified_embed_builder";
import { deleteUserData } from "../../services/database/repository/clients/delete_data";
import { logger } from "../../services/logger";

export const deleteMyDataCommand: Command = {
    data: new SlashCommandBuilder()
        .setName("delete_my_data")
        .setDescription(
            "Permanently delete all your Purrfit data in every server",
        )
        .addBooleanOption((opt) =>
            opt
                .setName("confirm")
                .setDescription(
                    "Set to True to confirm. This cannot be undone.",
                )
                .setRequired(true),
        ),

    //? Works in DMs too: it is about the user, not a server
    async execute(interaction: ChatInputCommandInteraction) {
        const confirmed = interaction.options.getBoolean("confirm", true);
        if (!confirmed) {
            await sendSimpleEmbed(interaction, {
                title: "Nothing was deleted",
                description:
                    "Run the command again with `confirm: True` to permanently delete your balances and coins in every server.",
                eph: true,
            });
            return;
        }
        try {
            const deleted = await deleteUserData(interaction.user.id);
            logger.info("Datos de usuario eliminados a pedido", {
                userId: interaction.user.id,
                ...deleted,
            });
            await sendSimpleEmbed(interaction, {
                title: "🗑️ Your data was deleted",
                description:
                    "Your balances and crypto holdings were removed from every server. An active `/work` cooldown stays until it expires.",
                thumType: "success",
                eph: true,
            });
        } catch (error) {
            logger.error("Error en comando delete_my_data", { error });
            await internalErrorEmbed(interaction);
        }
    },
};
