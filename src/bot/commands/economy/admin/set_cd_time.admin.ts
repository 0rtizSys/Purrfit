import {
    SlashCommandBuilder,
    SlashCommandOptionsOnlyBuilder,
    ChatInputCommandInteraction,
    PermissionFlagsBits,
} from "discord.js";

import {
    MAX_COOLDOWN_SECONDS,
    setCdTime,
} from "../../../services/database/repository/servers/set_cd_time";

import { getCdTime } from "../../../services/database/repository/servers/get_cd_time";

import {
    sendSimpleEmbed,
    internalErrorEmbed,
    notEnoughPermsEmbed,
    sendErrorEmbed,
} from "../../../Helpers/simplified_embed_builder";

import { requireGuild } from "../../../Helpers/require_guild";
import { logger } from "../../../services/logger";
import { Emoji } from "../../../ui/theme";
import { formatDuration } from "../../../ui/format";

export interface Command {
    data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
    execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

export const setCdTimeAdmin: Command = {
    data: new SlashCommandBuilder()
        .setName("set_cooldown_time")
        .setDescription("Change the /work cooldown (in seconds)")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addIntegerOption((opt) =>
            opt
                .setName("time")
                .setDescription("Cooldown in seconds (e.g. 3600 = 1 hour)")
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(MAX_COOLDOWN_SECONDS),
        ),
    async execute(interaction: ChatInputCommandInteraction) {
        if (!(await requireGuild(interaction))) return;
        if (
            !interaction.memberPermissions?.has(
                PermissionFlagsBits.Administrator,
            )
        ) {
            await notEnoughPermsEmbed(interaction);
            return;
        }
        const guildId = interaction.guild!.id;
        const newTime = interaction.options.getInteger("time", true);
        if (newTime <= 0 || newTime > MAX_COOLDOWN_SECONDS) {
            await sendErrorEmbed(
                interaction,
                "Invalid cooldown",
                `The cooldown must be between \`1s\` and \`${formatDuration(MAX_COOLDOWN_SECONDS)}\`.`,
            );
            return;
        }
        await interaction.deferReply();
        try {
            const oldTime = await getCdTime(guildId);
            if (await setCdTime(guildId, newTime))
                throw new Error("Failure on function setCdTime");
            await sendSimpleEmbed(interaction, {
                title: `${Emoji.settings} Work cooldown updated`,
                description: `\`${formatDuration(oldTime)}\` → \`${formatDuration(newTime)}\``,
                author: interaction.user,
                tone: "admin",
                timestamp: true,
            });
        } catch (err) {
            logger.error("Error en comando set_cooldown_time", { error: err });
            await internalErrorEmbed(interaction);
        }
    },
};
