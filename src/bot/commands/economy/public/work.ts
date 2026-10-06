import { randomInt } from "crypto";

import { claimWorkReward } from "../../../services/database/repository/clients/work";

import { getCdTime } from "../../../services/database/repository/servers/get_cd_time";

import { getEcoSymbol } from "../../../services/database/repository/servers/get_eco_symbol";

import { sendSimpleEmbed } from "../../../Helpers/simplified_embed_builder";
import { cmd } from "../../../framework/context";
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

import type { PrefixCommand } from "../../../framework/types";

export const workCommand: PrefixCommand = {
    name: "work",
    aliases: ["w"],
    description: "Work to generate money",

    async execute(ctx) {
        const ranGains = randomValues(TEMP_MIN, TEMP_MAX);
        const { guildId } = ctx;
        const userId = ctx.user.id;
        const [cdTime, symbol] = await Promise.all([
            getCdTime(guildId),
            getEcoSymbol(guildId),
        ]);
        //? Cooldown claim + payout run in one transaction, so spamming
        //? the command in parallel can only pay once per cooldown window
        const result = await claimWorkReward(
            userId,
            guildId,
            ranGains,
            cdTime * 1000,
        );
        if (!result.ok) {
            await sendSimpleEmbed(ctx, {
                title: `${Emoji.cooldown} Taking a break`,
                description: `You are still tired from your last shift.
You can work again ${relativeTime(Date.now() + result.remaining)}.`,
                tone: "cooldown",
            });
            return;
        }
        const shift = SHIFTS[randomInt(SHIFTS.length)];
        await sendSimpleEmbed(ctx, {
            author: ctx.user,
            title: `${Emoji.work} Shift complete`,
            description: `${shift} and earned
${headline(`+${moneyText(symbol, ranGains)}`)}`,
            fields: [
                {
                    name: "Next shift",
                    value: relativeTime(Date.now() + cdTime * 1000),
                    inline: true,
                },
            ],
            hint: `Bank money earns daily interest. Move it with ${cmd(ctx, "deposit <amount>")}.`,
            tone: "success",
        });
    },
};
