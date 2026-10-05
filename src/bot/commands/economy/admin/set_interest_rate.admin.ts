import {
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    SlashCommandBuilder,
} from "discord.js";

import { Command } from "../../types";
import { requireGuild } from "../../../Helpers/require_guild";
import {
    internalErrorEmbed,
    notEnoughPermsEmbed,
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
import { logger } from "../../../services/logger";

export const setInterestRateAdmin: Command = {
    data: new SlashCommandBuilder()
        .setName("set_interest_rate")
        .setDescription("Set the server daily bank interest (percent)")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addNumberOption((opt) =>
            opt
                .setName("percent")
                .setDescription("From 0 to 5, up to 2 decimals (e.g. 2.5)")
                .setRequired(true)
                .setMinValue(0)
                .setMaxValue(5),
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!(await requireGuild(interaction))) return;
        //! Permission check first: nothing else runs for non-admins
        if (
            !interaction.memberPermissions?.has(
                PermissionFlagsBits.Administrator,
            )
        ) {
            await notEnoughPermsEmbed(interaction);
            return;
        }
        const percent = interaction.options.getNumber("percent", true);
        const bps = percentToBps(percent);
        if (!Number.isFinite(percent) || bps < 0 || bps > MAX_INTEREST_BPS) {
            await sendSimpleEmbed(interaction, {
                title: "✖️ Error",
                description: "The rate must be between `0` and `5` percent.",
                thumType: "error",
                eph: true,
            });
            return;
        }
        const guildId = interaction.guild!.id;
        try {
            const before = await getEconomySettings(guildId);
            await setInterestRate(guildId, bps);
            await sendSimpleEmbed(interaction, {
                title: "⚙️ Configuration saved",
                description: `Old interest rate: \`${formatBps(before.interestBps)}\`\nNew interest rate: \`${formatBps(bps)}\``,
                thumType: "success",
            });
        } catch (error) {
            logger.error("Error en comando set_interest_rate", { error });
            await internalErrorEmbed(interaction);
        }
    },
};
