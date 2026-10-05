import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";

import { sendSimpleEmbed } from "../../Helpers/simplified_embed_builder";
import { Command } from "../types";

export const pingSlash: Command = {
    data: new SlashCommandBuilder()
        .setName("ping")
        .setDescription("Check the bot latency"),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply();
        const sent = await interaction.fetchReply();
        const ping = sent.createdTimestamp - interaction.createdTimestamp;
        const api = interaction.client.ws.ping;

        await sendSimpleEmbed(interaction, {
            title: "🏓 Pong!",
            fields: [
                { name: "📶 Bot", value: `\`${ping}ms\``, inline: true },
                //? ws.ping is -1 until the first heartbeat after login
                {
                    name: "🛜 Discord API",
                    value: api >= 0 ? `\`${api}ms\`` : "`measuring…`",
                    inline: true,
                },
            ],
        });
    },
};
