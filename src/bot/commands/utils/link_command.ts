import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    SlashCommandBuilder,
} from "discord.js";
import type { Command } from "../types";
import { slashReplier } from "../../framework/context";
import { DEFAULT_PREFIX } from "../../framework/prefix";
import {
    sendErrorEmbed,
    sendSimpleEmbed,
} from "../../Helpers/simplified_embed_builder";
import { Emoji } from "../../ui/theme";

export type LinkCommandOptions = {
    name: string;
    description: string;
    /** Environment variable that holds the link (http or https). */
    env: string;
    title: string;
    text: string;
    button: string;
    /** What to say when the variable is not set. */
    missing: string;
};

/** The configured link, or null when it is empty or not an http(s) URL. */
export function readLink(value: string | undefined): string | null {
    if (!value) return null;
    try {
        const url = new URL(value);
        return url.protocol === "https:" || url.protocol === "http:"
            ? url.toString()
            : null;
    } catch {
        return null;
    }
}

/** A slash command that answers with one link button (/dashboard, /support). */
export function linkCommand(options: LinkCommandOptions): Command {
    return {
        data: new SlashCommandBuilder()
            .setName(options.name)
            .setDescription(options.description),

        async execute(interaction) {
            const replier = slashReplier(interaction, DEFAULT_PREFIX);
            const link = readLink(process.env[options.env]);
            if (!link) {
                await sendErrorEmbed(replier, "Not available", options.missing);
                return;
            }
            await sendSimpleEmbed(replier, {
                title: `${Emoji.cat} ${options.title}`,
                description: options.text,
                components: [
                    new ActionRowBuilder<ButtonBuilder>().addComponents(
                        new ButtonBuilder()
                            .setLabel(options.button)
                            .setStyle(ButtonStyle.Link)
                            .setURL(link),
                    ),
                ],
                eph: true,
            });
        },
    };
}
