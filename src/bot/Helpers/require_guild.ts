import { ChatInputCommandInteraction } from "discord.js";

import { sendErrorEmbed } from "./simplified_embed_builder";

export async function requireGuild(
    interaction: ChatInputCommandInteraction,
): Promise<boolean> {
    if (!interaction.inGuild()) {
        await sendErrorEmbed(
            interaction,
            "Server only",
            "This command only works inside a server, not in DMs.",
            "Every server has its own economy, so money lives there.",
        );
        return false;
    }
    return true;
}
