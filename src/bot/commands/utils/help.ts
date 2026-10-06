import { SlashCommandBuilder } from "discord.js";

import type { Command } from "../types";
import { slashReplier } from "../../framework/context";
import { DEFAULT_PREFIX } from "../../framework/prefix";
import { usageOf } from "../../framework/args";
import { sendSimpleEmbed } from "../../Helpers/simplified_embed_builder";
import { getPrefix } from "../../services/database/repository/servers/prefix";
import { Emoji } from "../../ui/theme";

//? Discord limits an embed field to 1024 characters
const FIELD_LIMIT = 1000;

/** Splits lines into chunks that fit one embed field. */
export function chunkLines(lines: string[], limit = FIELD_LIMIT): string[] {
    const chunks: string[] = [];
    let current = "";
    for (const line of lines) {
        if (current && current.length + line.length + 1 > limit) {
            chunks.push(current);
            current = "";
        }
        current = current ? `${current}\n${line}` : line;
    }
    if (current) chunks.push(current);
    return chunks;
}

export const helpCommand: Command = {
    data: new SlashCommandBuilder()
        .setName("help")
        .setDescription("See everything Purrfit can do"),

    async execute(interaction) {
        //? Lazy import: the registry imports this file too
        const { commandCategories } = await import("../../syncer");
        const prefix = interaction.guildId
            ? await getPrefix(interaction.guildId)
            : DEFAULT_PREFIX;
        const replier = slashReplier(interaction, prefix);

        const fields: { name: string; value: string }[] = [];
        const shortcuts: string[] = [];
        for (const category of commandCategories) {
            const lines = category.commands
                .filter((command) => command.permission !== "owner")
                .flatMap((command) => {
                    if (command.aliases?.length)
                        shortcuts.push(
                            `\`${command.aliases.join("`, `")}\` = ${command.name}`,
                        );
                    if (command.subcommands?.length)
                        return command.subcommands.map(
                            (sub) =>
                                `\`${prefix}${usageOf(command, sub)}\` · ${sub.description}`,
                        );
                    return [
                        `\`${prefix}${usageOf(command)}\` · ${command.description}`,
                    ];
                });
            chunkLines(lines).forEach((value, i) =>
                fields.push({
                    name:
                        i === 0 ? category.title : `${category.title} (cont.)`,
                    value,
                }),
            );
        }
        chunkLines(shortcuts).forEach((value, i) =>
            fields.push({
                name: i === 0 ? "⚡ Shortcuts" : "⚡ Shortcuts (cont.)",
                value,
            }),
        );

        const links = [
            process.env.SUPPORT_URL &&
                `[Support server](${process.env.SUPPORT_URL})`,
            process.env.DASHBOARD_URL &&
                `[Dashboard](${process.env.DASHBOARD_URL})`,
            process.env.PRIVACY_URL &&
                `[Privacy Policy](${process.env.PRIVACY_URL})`,
            process.env.TERMS_URL &&
                `[Terms of Service](${process.env.TERMS_URL})`,
        ].filter(Boolean);
        if (links.length)
            fields.push({ name: "🔗 Links", value: links.join(" · ") });

        await sendSimpleEmbed(replier, {
            title: `${Emoji.cat} Purrfit help`,
            description: `Work, save in the bank, trade simulated crypto and climb the leaderboard. Money is separate in every server.\nCommands start with \`${prefix}\` in this server, and the \`<value>\` parts are what you type.`,
            fields,
            thumbnail: interaction.client.user.displayAvatarURL(),
            hint: `New here? Start with \`${prefix}work\`, then \`${prefix}deposit <amount>\` your earnings.`,
            eph: true,
        });
    },
};
