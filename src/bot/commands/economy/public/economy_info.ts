import type { PrefixCommand } from "../../../framework/types";
import { sendSimpleEmbed } from "../../../Helpers/simplified_embed_builder";
import { getEcoSymbol } from "../../../services/database/repository/servers/get_eco_symbol";
import { getCdTime } from "../../../services/database/repository/servers/get_cd_time";
import { getEconomySettings } from "../../../services/database/repository/servers/economy_settings";
import {
    formatBps,
    MAX_DAILY_INTEREST,
} from "../../../services/economy/policy";
import { Emoji } from "../../../ui/theme";
import { formatDuration, money, moneyText } from "../../../ui/format";

export const economyInfoCommand: PrefixCommand = {
    name: "economy_info",
    aliases: ["eco", "info"],
    description: "See this server's economy settings, taxes and treasury",

    async execute(ctx) {
        const guildId = ctx.guildId;
        await ctx.defer();
        const [symbol, cooldown, settings] = await Promise.all([
            getEcoSymbol(guildId),
            getCdTime(guildId),
            getEconomySettings(guildId),
        ]);
        await sendSimpleEmbed(ctx, {
            title: `${Emoji.bank} ${ctx.guild.name} economy`,
            description: "How money works in this server.",
            thumbnail: ctx.guild.iconURL(),
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
    },
};
