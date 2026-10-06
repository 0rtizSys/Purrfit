import type { PrefixCommand } from "../../../framework/types";
import {
    sendErrorEmbed,
    sendSimpleEmbed,
} from "../../../Helpers/simplified_embed_builder";
import {
    getEconomySettings,
    setInterestRate,
} from "../../../services/database/repository/servers/economy_settings";
import {
    formatBps,
    MAX_INTEREST_BPS,
    percentToBps,
} from "../../../services/economy/policy";
import { Emoji } from "../../../ui/theme";

export const setInterestRateAdmin: PrefixCommand = {
    name: "set_interest_rate",
    aliases: ["setinterest"],
    description: "Set the server daily bank interest (percent)",
    permission: "admin",
    args: [
        {
            name: "percent",
            kind: "number",
            description: "From 0 to 5, up to 2 decimals (e.g. 2.5)",
            min: 0,
            max: 5,
        },
    ],

    async execute(ctx) {
        const percent = ctx.args.number("percent");
        const bps = percentToBps(percent);
        if (!Number.isFinite(percent) || bps < 0 || bps > MAX_INTEREST_BPS) {
            await sendErrorEmbed(
                ctx,
                "Invalid rate",
                "The rate must be between `0%` and `5%`.",
            );
            return;
        }
        const guildId = ctx.guildId;
        const before = await getEconomySettings(guildId);
        await setInterestRate(guildId, bps);
        await sendSimpleEmbed(ctx, {
            title: `${Emoji.settings} Bank interest updated`,
            description: `\`${formatBps(before.interestBps)}\` → \`${formatBps(bps)}\``,
            author: ctx.user,
            tone: "admin",
            timestamp: true,
        });
    },
};
