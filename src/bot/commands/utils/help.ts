import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

import { Command } from "../types";
import { sendSimpleEmbed } from "../../Helpers/simplified_embed_builder";

export const helpCommand: Command = {
    data: new SlashCommandBuilder()
        .setName("help")
        .setDescription("See everything Purrfit can do"),

    async execute(interaction: ChatInputCommandInteraction) {
        //? Lazy import: the registry imports this file too
        const { commandCategories } = await import("../../syncer");

        const fields = commandCategories.map((category) => ({
            name: category.title,
            value: category.commands
                .map((cmd) => `\`/${cmd.data.name}\` · ${cmd.data.description}`)
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
            fields.push({ name: "Links", value: links.join(" · ") });

        await sendSimpleEmbed(interaction, {
            title: "🐱 Purrfit help",
            description:
                "Purrfit is an economy bot: work, save in the bank, trade simulated crypto and climb the leaderboard. Money is separate in every server.",
            fields,
            eph: true,
        });
    },
};
