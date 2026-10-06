import type { PrefixCommand } from "../../framework/types";
import {
    sendErrorEmbed,
    sendSimpleEmbed,
} from "../../Helpers/simplified_embed_builder";
import { Emoji } from "../../ui/theme";
import {
    deployCommands,
    readDeployEnv,
} from "../../services/discord/deploy_commands";
import { logger } from "../../services/logger";

//? Owner only (OWNER_ID): the dispatcher refuses everybody else
export const syncCommands: PrefixCommand = {
    name: "sync",
    permission: "owner",
    description: "Publish the slash commands (owner only)",

    async execute(ctx) {
        await ctx.defer();
        try {
            const summary = await deployCommands(readDeployEnv());
            await sendSimpleEmbed(ctx, {
                title: `${Emoji.success} Slash commands deployed`,
                fields: [
                    {
                        name: "Global",
                        value: `\`${summary.global}\``,
                        inline: true,
                    },
                    {
                        name: "Old server copies removed",
                        value: summary.guildCleared ? "`yes`" : "`no GUILD_ID`",
                        inline: true,
                    },
                ],
                hint: "Global commands can take a few minutes to show up everywhere.",
                tone: "admin",
            });
        } catch (error) {
            logger.error("Error al sincronizar comandos", { error });
            await sendErrorEmbed(
                ctx,
                "Deploy failed",
                "The commands could not be published. Check the bot logs.",
            );
        }
    },
};
