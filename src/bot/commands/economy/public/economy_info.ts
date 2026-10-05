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
import { Emoji } from "../../../ui/theme";
import { formatDuration, money, moneyText } from "../../../ui/format";

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
                title: `${Emoji.bank} ${interaction.guild!.name} economy`,
                description: "How money works in this server.",
                thumbnail: interaction.guild!.iconURL(),
                fields: [
                    {
                        name: "Currency",
                        value: `\`${symbol}\``,
                        inline: true,
                    },
                    {
                        name: `${Emoji.work} Work cooldown`,
                        value: `\`${formatDuration(cooldown)}\``,
                        inline: true,
                    },
                    {
                        name: `${Emoji.tax} Tax rate`,
                        value: `\`${formatBps(settings.taxBps)}\``,
                        inline: true,
                    },
                    {
                        name: `${Emoji.bank} Bank interest`,
                        value: `\`${formatBps(settings.interestBps)}\` per day\n-# max ${moneyText(symbol, MAX_DAILY_INTEREST)} per day`,
                        inline: true,
                    },
                    {
                        name: `${Emoji.total} Treasury`,
                        value: money(symbol, settings.treasury),
                        inline: true,
                    },
                ],
                hint: "Taxes from transfers and crypto sales go to the treasury.",
            });
        } catch (error) {
            logger.error("Error en comando economy_info", { error });
            await internalErrorEmbed(interaction);
        }
    },
};
