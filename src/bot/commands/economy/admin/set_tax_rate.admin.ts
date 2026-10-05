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
import { logger } from "../../../services/logger";
import { Emoji } from "../../../ui/theme";

export const setTaxRateAdmin: Command = {
    data: new SlashCommandBuilder()
        .setName("set_tax_rate")
        .setDescription(
            "Set the server tax on transfers and crypto sales (percent)",
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addNumberOption((opt) =>
            opt
                .setName("percent")
                .setDescription("From 0 to 50, up to 2 decimals (e.g. 2.5)")
                .setRequired(true)
                .setMinValue(0)
                .setMaxValue(50),
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
        if (!Number.isFinite(percent) || bps < 0 || bps > MAX_TAX_BPS) {
            await sendErrorEmbed(
                interaction,
                "Invalid rate",
                "The rate must be between `0%` and `50%`.",
            );
            return;
        }
        const guildId = interaction.guild!.id;
        try {
            const before = await getEconomySettings(guildId);
            await setTaxRate(guildId, bps);
            await sendSimpleEmbed(interaction, {
                title: `${Emoji.settings} Tax rate updated`,
                description: `\`${formatBps(before.taxBps)}\` → \`${formatBps(bps)}\``,
                author: interaction.user,
                tone: "admin",
                timestamp: true,
            });
        } catch (error) {
            logger.error("Error en comando set_tax_rate", { error });
            await internalErrorEmbed(interaction);
        }
    },
};
