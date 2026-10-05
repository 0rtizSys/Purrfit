import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    MessageFlags,
} from "discord.js";
import { Command } from "../types";
import { notEnoughPermsEmbed } from "../../Helpers/simplified_embed_builder";
import {
    deployCommands,
    readDeployEnv,
} from "../../services/discord/deploy_commands";
import { logger } from "../../services/logger";

//? Only registered in GUILD_ID (see syncer.ts devCmds), and OWNER_ID-only at runtime
export const syncSlash: Command = {
    data: new SlashCommandBuilder()
        .setName("sync_slash_guild")
        .setDescription(
            "Publish global commands and dev commands (owner only)",
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        if (interaction.user.id !== process.env.OWNER_ID) {
            await notEnoughPermsEmbed(interaction);
            return;
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            const summary = await deployCommands(readDeployEnv());
            await interaction.editReply({
                content: `✅ \`${summary.global}\` comandos globales y \`${summary.guild}\` de desarrollo publicados.`,
            });
        } catch (error) {
            logger.error("Error al sincronizar comandos", { error });
            await interaction.editReply({
                content: "❌ Error en la sincronización.",
            });
        }
    },
};
