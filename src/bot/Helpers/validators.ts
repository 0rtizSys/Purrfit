import type { User } from "discord.js";
import type { Replier } from "../framework/types";
import {
    amountErrorEmbed,
    botTargetEmbed,
    SameUserEmbed,
} from "./simplified_embed_builder";
import z from "zod";

//? ------------------------
//? SCHEMAS AND DEFINITIONS
//? ------------------------

export const MIN_AMOUNT = 1;
export const MAX_AMOUNT = 1_000_000_000;

const UntrustedData = z.object({
    UntAmount: z.number().int().min(MIN_AMOUNT).max(MAX_AMOUNT),
});

//? ---------------------
//? EXPORTABLE FUNCTIONS
//? ---------------------

export async function isInvalidAmount(
    replier: Replier,
    amount: number,
): Promise<boolean> {
    if (!validateAmount(amount)) {
        await amountErrorEmbed(replier);
        return true;
    }
    return false;
}

export async function isSelfTransfer(
    replier: Replier,
    userId: string,
    targetId: string,
) {
    if (userId === targetId) {
        await SameUserEmbed(replier);
        return true;
    }
    return false;
}

export async function isBotAction(replier: Replier, target: User) {
    //? The argument parser already resolved the user: no extra request needed.
    if (target.bot) {
        await botTargetEmbed(replier);
        return true;
    }
    return false;
}

// test

export function validateAmount(amount: number): boolean {
    const input = { UntAmount: amount };
    const data = UntrustedData.safeParse(input);
    return data.success;
}
