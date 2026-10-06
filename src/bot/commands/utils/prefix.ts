import {
    notEnoughPermsEmbed,
    sendErrorEmbed,
    sendSimpleEmbed,
} from "../../Helpers/simplified_embed_builder";
import { cmd } from "../../framework/context";
import { checkPrefix, DEFAULT_PREFIX } from "../../framework/prefix";
import type { PrefixCommand } from "../../framework/types";
import { setPrefix } from "../../services/database/repository/servers/prefix";
import { Emoji } from "../../ui/theme";

export const prefixCommand: PrefixCommand = {
    name: "prefix",
    aliases: ["setprefix"],
    description: "See this server's prefix, or change it (admins)",
    args: [
        {
            name: "new_prefix",
            kind: "word",
            optional: true,
            description: `1 to 5 characters, or "reset" for ${DEFAULT_PREFIX}`,
        },
    ],

    async execute(ctx) {
        const wanted = ctx.args.stringOpt("new_prefix");
        if (wanted === null) {
            await sendSimpleEmbed(ctx, {
                title: `${Emoji.settings} Server prefix`,
                description: `The prefix in this server is \`${ctx.prefix}\``,
                hint: `Admins can change it with ${cmd(ctx, "prefix <new_prefix>")} or from the dashboard.`,
            });
            return;
        }
        //! Reading is for everyone, changing is for admins
        if (!ctx.isAdmin) {
            await notEnoughPermsEmbed(ctx);
            return;
        }
        const check = checkPrefix(
            wanted.toLowerCase() === "reset" ? DEFAULT_PREFIX : wanted,
        );
        if (!check.ok) {
            await sendErrorEmbed(ctx, "Invalid prefix", check.reason);
            return;
        }
        await setPrefix(ctx.guildId, check.prefix);
        await sendSimpleEmbed(ctx, {
            title: `${Emoji.settings} Prefix updated`,
            description: `\`${ctx.prefix}\` → \`${check.prefix}\``,
            author: ctx.user,
            tone: "admin",
            timestamp: true,
            hint: `Try \`${check.prefix}work\`.`,
        });
    },
};
