import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

import { Command } from "../../types";
import { requireGuild } from "../../../Helpers/require_guild";
import {
    internalErrorEmbed,
    sendSimpleEmbed,
} from "../../../Helpers/simplified_embed_builder";
import { getEcoSymbol } from "../../../services/database/repository/servers/get_eco_symbol";
import { getCdTime } from "../../../services/database/repository/servers/get_cd_time";
import { getEconomySettings } from "../../../services/database/repository/servers/economy_settings";
import {
    formatBps,
    MAX_DAILY_INTEREST,
} from "../../../services/economy/policy";
import { logger } from "../../../services/logger";

export const economyInfoCommand: Command = {
    data: new SlashCommandBuilder()
        .setName("economy_info")
        .setDescription(
            "See this server's economy settings, taxes and treasury",
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!(await requireGuild(interaction))) return;
        const guildId = interaction.guild!.id;
        await interaction.deferReply();
        try {
            const [symbol, cooldown, settings] = await Promise.all([
                getEcoSymbol(guildId),
                getCdTime(guildId),
                getEconomySettings(guildId),
            ]);
            await sendSimpleEmbed(interaction, {
                title: `🏦 ${interaction.guild!.name} economy`,
                fields: [
                    { name: "Symbol", value: `\`${symbol}\``, inline: true },
                    {
                        name: "/work cooldown",
                        value: `\`${cooldown}s\``,
                        inline: true,
                    },
                    {
                        name: "Tax rate",
                        value: `\`${formatBps(settings.taxBps)}\``,
                        inline: true,
                    },
                    {
                        name: "Bank interest",
                        value: `\`${formatBps(settings.interestBps)}\` per day (max \`${symbol}${MAX_DAILY_INTEREST}\`)`,
                        inline: true,
                    },
                    {
                        name: "Treasury",
                        value: `\`${symbol}${settings.treasury}\``,
                        inline: true,
                    },
                ],
            });
        } catch (error) {
            logger.error("Error en comando economy_info", { error });
            await internalErrorEmbed(interaction);
        }
    },
};
