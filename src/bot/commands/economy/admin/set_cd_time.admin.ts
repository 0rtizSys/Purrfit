import type { PrefixCommand } from "../../../framework/types";
import {
    MAX_COOLDOWN_SECONDS,
    setCdTime,
} from "../../../services/database/repository/servers/set_cd_time";

import { getCdTime } from "../../../services/database/repository/servers/get_cd_time";

import {
    sendSimpleEmbed,
    sendErrorEmbed,
} from "../../../Helpers/simplified_embed_builder";

import { Emoji } from "../../../ui/theme";
import { formatDuration } from "../../../ui/format";

export const setCdTimeAdmin: PrefixCommand = {
    name: "set_cooldown_time",
    aliases: ["setcd"],
    description: "Change the work cooldown (in seconds)",
    permission: "admin",
    args: [
        {
            name: "seconds",
            kind: "integer",
            description: "Cooldown in seconds (e.g. 3600 = 1 hour)",
            min: 1,
            max: MAX_COOLDOWN_SECONDS,
        },
    ],
    async execute(ctx) {
        const guildId = ctx.guildId;
        const newTime = ctx.args.integer("seconds");
        if (newTime <= 0 || newTime > MAX_COOLDOWN_SECONDS) {
            await sendErrorEmbed(
                ctx,
                "Invalid cooldown",
                `The cooldown must be between \`1s\` and \`${formatDuration(MAX_COOLDOWN_SECONDS)}\`.`,
            );
            return;
        }
        await ctx.defer();
        const oldTime = await getCdTime(guildId);
        if (await setCdTime(guildId, newTime))
            throw new Error("Failure on function setCdTime");
        await sendSimpleEmbed(ctx, {
            title: `${Emoji.settings} Work cooldown updated`,
            description: `\`${formatDuration(oldTime)}\` → \`${formatDuration(newTime)}\``,
            author: ctx.user,
            tone: "admin",
            timestamp: true,
        });
    },
};
