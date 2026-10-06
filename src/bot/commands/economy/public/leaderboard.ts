import type { PrefixCommand } from "../../../framework/types";
import { cmd } from "../../../framework/context";
import { sendSimpleEmbed } from "../../../Helpers/simplified_embed_builder";
import { getEcoSymbol } from "../../../services/database/repository/servers/get_eco_symbol";
import {
    getLeaderboard,
    getUserRank,
    LeaderboardSort,
} from "../../../services/database/repository/clients/leaderboard";
import { Emoji } from "../../../ui/theme";
import { money } from "../../../ui/format";

const MEDALS = ["🥇", "🥈", "🥉"];

export const leaderboardCommand: PrefixCommand = {
    name: "leaderboard",
    aliases: ["lb", "top"],
    description: "See the richest users in this server",
    args: [
        {
            name: "by",
            kind: "choice",
            choices: ["total", "wallet", "bank"],
            optional: true,
            description: "Rank by total, wallet or bank (default total)",
        },
    ],

    async execute(ctx) {
        const sort = (ctx.args.stringOpt("by") ?? "total") as LeaderboardSort;
        if (!["total", "wallet", "bank"].includes(sort)) return;
        const guildId = ctx.guildId;
        await ctx.defer();
        const [entries, rank, symbol] = await Promise.all([
            getLeaderboard(guildId, sort),
            getUserRank(ctx.user.id, guildId, sort),
            getEcoSymbol(guildId),
        ]);
        const label = `${sort[0].toUpperCase()}${sort.slice(1)}`;
        const lines = entries.map((entry, i) => {
            const position = MEDALS[i] ?? `\`#${i + 1}\``;
            const isCaller = entry.userId === ctx.user.id;
            //? Mentions inside embeds render as names and never ping
            const line = `${position} <@${entry.userId}> · ${money(symbol, entry[sort])}`;
            return isCaller ? `**${line}** ← you` : line;
        });
        await sendSimpleEmbed(ctx, {
            title: `${Emoji.trophy} ${ctx.guild.name} leaderboard`,
            description: lines.length
                ? `Ranked by **${label}**\n\n${lines.join("\n")}`
                : `Nobody has money yet. Use ${cmd(ctx, "work")} to get started!`,
            thumbnail: ctx.guild.iconURL(),
            fields: [
                {
                    name: `${Emoji.rank} Your rank`,
                    value: rank ? `**#${rank}**` : "Not ranked yet",
                },
            ],
        });
    },
};
