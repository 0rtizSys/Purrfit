import type { PrefixCommand } from "../../../framework/types";
import {
    sendErrorEmbed,
    sendSimpleEmbed,
} from "../../../Helpers/simplified_embed_builder";
import {
    getEconomySettings,
    setTaxRate,
} from "../../../services/database/repository/servers/economy_settings";
import {
    formatBps,
    MAX_TAX_BPS,
    percentToBps,
} from "../../../services/economy/policy";
import { Emoji } from "../../../ui/theme";

export const setTaxRateAdmin: PrefixCommand = {
    name: "set_tax_rate",
    aliases: ["settax"],
    description: "Set the server tax on transfers and crypto sales (percent)",
    permission: "admin",
    args: [
        {
            name: "percent",
            kind: "number",
            description: "From 0 to 50, up to 2 decimals (e.g. 2.5)",
            min: 0,
            max: 50,
        },
    ],

    async execute(ctx) {
        const percent = ctx.args.number("percent");
        const bps = percentToBps(percent);
        if (!Number.isFinite(percent) || bps < 0 || bps > MAX_TAX_BPS) {
            await sendErrorEmbed(
                ctx,
                "Invalid rate",
                "The rate must be between `0%` and `50%`.",
            );
            return;
        }
        const guildId = ctx.guildId;
        const before = await getEconomySettings(guildId);
        await setTaxRate(guildId, bps);
        await sendSimpleEmbed(ctx, {
            title: `${Emoji.settings} Tax rate updated`,
            description: `\`${formatBps(before.taxBps)}\` → \`${formatBps(bps)}\``,
            author: ctx.user,
            tone: "admin",
            timestamp: true,
        });
    },
};
