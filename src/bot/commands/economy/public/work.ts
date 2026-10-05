import {
    SlashCommandBuilder,
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
import { Emoji } from "../../../ui/theme";
import { headline, moneyText, relativeTime } from "../../../ui/format";

const TEMP_MIN: number = 100;
const TEMP_MAX: number = 1000;

function randomValues(Na: number, Nb: number) {
    return randomInt(Na, Nb + 1);
}

//? Flavor text for a finished shift; purely cosmetic
const SHIFTS = [
    "You brushed a very fluffy Persian",
    "You delivered tuna across town",
    "You tested cardboard boxes for comfort",
    "You chased the red dot for a laser startup",
    "You guarded the warehouse from mice",
    "You modeled for a cat food commercial",
    "You knocked things off desks for science",
    "You napped professionally in a sunbeam",
];

import { Command } from "../../types";

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
                    title: `${Emoji.cooldown} Taking a break`,
                    description: `You are still tired from your last shift.\nYou can work again ${relativeTime(Date.now() + result.remaining)}.`,
                    tone: "cooldown",
                    eph: true,
                });
                return;
            }
            const shift = SHIFTS[randomInt(SHIFTS.length)];
            await sendSimpleEmbed(interaction, {
                author: interaction.user,
                title: `${Emoji.work} Shift complete`,
                description: `${shift} and earned\n${headline(`+${moneyText(symbol, ranGains)}`)}`,
                fields: [
                    {
                        name: "Next shift",
                        value: relativeTime(Date.now() + cdTime * 1000),
                        inline: true,
                    },
                ],
                hint: "Bank money earns daily interest. Move it with `/deposit`.",
                tone: "success",
            });
        } catch (e) {
            logger.error("Error en comando work", { error: e });
            await internalErrorEmbed(interaction);
        }
    },
};
