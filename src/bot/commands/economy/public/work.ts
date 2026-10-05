import {
    SlashCommandBuilder,
    SlashCommandOptionsOnlyBuilder,
    ChatInputCommandInteraction,
    MessageFlags,
} from "discord.js";

import { randomInt } from "crypto";

import { claimWorkReward } from "../../../services/database/repository/clients/work";

import { getCdTime } from "../../../services/database/repository/servers/get_cd_time";

import { getEcoSymbol } from "../../../services/database/repository/servers/get_eco_symbol";

import { requireGuild } from "../../../Helpers/require_guild";

import {
    sendSimpleEmbed,
    internalErrorEmbed,
} from "../../../Helpers/simplified_embed_builder";
import { logger } from "../../../services/logger";

const TEMP_MIN: number = 100;
const TEMP_MAX: number = 1000;

function randomValues(Na: number, Nb: number) {
    return randomInt(Na, Nb + 1);
}

export type Command = {
    data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
    execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
};

export const workCommand: Command = {
    data: new SlashCommandBuilder()
        .setName("work")
        .setDescription("Work to generate money")
        .addBooleanOption((opt) =>
            opt
                .setName("visibility")
                .setDescription("People can see your earnings"),
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!(await requireGuild(interaction))) return;
        const ranGains = randomValues(TEMP_MIN, TEMP_MAX);
        const guildId = interaction.guild!.id;
        const userId = interaction.user.id;
        const isPublic = interaction.options.getBoolean("visibility") ?? false;
        await interaction.deferReply({
            flags: !isPublic ? MessageFlags.Ephemeral : undefined,
        });
        try {
            const [cdTime, symbol] = await Promise.all([
                getCdTime(guildId),
                getEcoSymbol(guildId),
            ]);
            //? Cooldown claim + payout run in one transaction, so spamming
            //? /work in parallel can only pay once per cooldown window
            const result = await claimWorkReward(
                userId,
                guildId,
                ranGains,
                cdTime * 1000,
            );
            if (!result.ok) {
                await sendSimpleEmbed(interaction, {
                    title: "On Cooldown 🧊",
                    description: `Wait \`${Math.ceil(result.remaining / 1000)}\` seconds to work again 🕐!`,
                    thumType: "error",
                });
                return;
            }
            await sendSimpleEmbed(interaction, {
                title: "💼 Work",
                description: `${interaction.user} earned \`${symbol}${ranGains}\` 💵`,
                eph: !isPublic,
            });
        } catch (e) {
            logger.error("Error en comando work", { error: e });
            await internalErrorEmbed(interaction);
        }
    },
};
