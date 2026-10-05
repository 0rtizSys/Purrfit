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
} from "../../../Helpers/simplified_embed_builder";

import { requireGuild } from "../../../Helpers/require_guild";
import { logger } from "../../../services/logger";

export interface Command {
    data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
    execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

export const setCdTimeAdmin: Command = {
    data: new SlashCommandBuilder()
        .setName("set_cooldown_time")
        .setDescription("change the cooldown time for the command work")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addIntegerOption((opt) =>
            opt
                .setName("time")
                .setDescription("Use seconds to avoid any problems")
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
            await sendSimpleEmbed(interaction, {
                title: "✖️ Error",
                description: `Time must be between \`1\` and \`${MAX_COOLDOWN_SECONDS}\` seconds`,
                thumType: "error",
                eph: true,
            });
            return;
        }
        await interaction.deferReply();
        try {
            const oldTime = await getCdTime(guildId);
            if (await setCdTime(guildId, newTime))
                throw new Error("Failure on function setCdTime");
            await sendSimpleEmbed(interaction, {
                title: "⚙️ Configurations saved",
                description: `Old cooldown time: \`${oldTime}s\`\nNew cooldown time: \`${newTime}s\``,
                thumType: "success",
            });
        } catch (err) {
            logger.error("Error en comando set_cooldown_time", { error: err });
            await internalErrorEmbed(interaction);
        }
    },
};
