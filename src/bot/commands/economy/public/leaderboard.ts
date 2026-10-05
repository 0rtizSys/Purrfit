import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

import { Command } from "../../types";
import { requireGuild } from "../../../Helpers/require_guild";
import {
    internalErrorEmbed,
    sendSimpleEmbed,
} from "../../../Helpers/simplified_embed_builder";
import { getEcoSymbol } from "../../../services/database/repository/servers/get_eco_symbol";
import {
    getLeaderboard,
    getUserRank,
    LeaderboardSort,
} from "../../../services/database/repository/clients/leaderboard";
import { logger } from "../../../services/logger";

const MEDALS = ["🥇", "🥈", "🥉"];

export const leaderboardCommand: Command = {
    data: new SlashCommandBuilder()
        .setName("leaderboard")
        .setDescription("See the richest users in this server")
        .addStringOption((opt) =>
            opt
                .setName("by")
                .setDescription("Rank by total, wallet or bank (default total)")
                .addChoices(
                    { name: "Total", value: "total" },
                    { name: "Wallet", value: "wallet" },
                    { name: "Bank", value: "bank" },
                ),
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!(await requireGuild(interaction))) return;
        const sort = (interaction.options.getString("by") ??
            "total") as LeaderboardSort;
        if (!["total", "wallet", "bank"].includes(sort)) return;
        const guildId = interaction.guild!.id;
        await interaction.deferReply();
        try {
            const [entries, rank, symbol] = await Promise.all([
                getLeaderboard(guildId, sort),
                getUserRank(interaction.user.id, guildId, sort),
                getEcoSymbol(guildId),
            ]);
            const lines = entries.map((entry, i) => {
                const position = MEDALS[i] ?? `\`#${i + 1}\``;
                //? Mentions inside embeds render as names and never ping
                return `${position} <@${entry.userId}> · \`${symbol}${entry[sort]}\``;
            });
            await sendSimpleEmbed(interaction, {
                title: `🏆 Leaderboard · ${sort[0].toUpperCase()}${sort.slice(1)}`,
                description: lines.length
                    ? lines.join("\n")
                    : "Nobody has money yet. Use `/work` to get started!",
                fields: [
                    {
                        name: "Your rank",
                        value: rank ? `#${rank}` : "Not ranked yet",
                    },
                ],
            });
        } catch (error) {
            logger.error("Error en comando leaderboard", { error });
            await internalErrorEmbed(interaction);
        }
    },
};
