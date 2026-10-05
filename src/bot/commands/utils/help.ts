import {
    ApplicationCommandOptionType,
    ChatInputCommandInteraction,
    SlashCommandBuilder,
} from "discord.js";

import { Command } from "../types";
import { sendSimpleEmbed } from "../../Helpers/simplified_embed_builder";
import { Emoji } from "../../ui/theme";
import { logger } from "../../services/logger";

//? Global command ids, used to render clickable `</name:id>` mentions.
//? They only change when commands are re-deployed, so one fetch per process
//? is enough; on failure /help falls back to plain `/name` text.
let commandIds: Map<string, string> | null = null;

async function getCommandIds(
    interaction: ChatInputCommandInteraction,
): Promise<Map<string, string>> {
    if (commandIds) return commandIds;
    try {
        const fetched = await interaction.client.application.commands.fetch();
        commandIds = new Map(fetched.map((cmd) => [cmd.name, cmd.id]));
    } catch (error) {
        logger.warn("No se pudieron obtener los IDs de comandos", { error });
        return new Map();
    }
    return commandIds;
}

function mention(name: string, ids: Map<string, string>, sub?: string) {
    const full = sub ? `${name} ${sub}` : name;
    const id = ids.get(name);
    return id ? `</${full}:${id}>` : `\`/${full}\``;
}

export const helpCommand: Command = {
    data: new SlashCommandBuilder()
        .setName("help")
        .setDescription("See everything Purrfit can do"),

    async execute(interaction: ChatInputCommandInteraction) {
        //? Lazy import: the registry imports this file too
        const { commandCategories } = await import("../../syncer");
        const ids = await getCommandIds(interaction);

        const fields = commandCategories.map((category) => ({
            name: category.title,
            value: category.commands
                .flatMap((cmd) => {
                    const json = cmd.data.toJSON();
                    const subs = (json.options ?? []).filter(
                        (opt) =>
                            opt.type ===
                            ApplicationCommandOptionType.Subcommand,
                    );
                    //? Commands with subcommands list each one, so every
                    //? line is clickable and runs something
                    if (subs.length)
                        return subs.map(
                            (sub) =>
                                `${mention(json.name, ids, sub.name)} · ${sub.description}`,
                        );
                    return [`${mention(json.name, ids)} · ${json.description}`];
                })
                .join("\n"),
        }));

        const links = [
            process.env.SUPPORT_URL &&
                `[Support server](${process.env.SUPPORT_URL})`,
            process.env.PRIVACY_URL &&
                `[Privacy Policy](${process.env.PRIVACY_URL})`,
            process.env.TERMS_URL &&
                `[Terms of Service](${process.env.TERMS_URL})`,
        ].filter(Boolean);
        if (links.length)
            fields.push({ name: "🔗 Links", value: links.join(" · ") });

        await sendSimpleEmbed(interaction, {
            title: `${Emoji.cat} Purrfit help`,
            description:
                "Work, save in the bank, trade simulated crypto and climb the leaderboard. Money is separate in every server.",
            fields,
            thumbnail: interaction.client.user.displayAvatarURL(),
            hint: "New here? Start with /work, then /deposit your earnings.",
            eph: true,
        });
    },
};
