import { ChatInputCommandInteraction, User } from "discord.js";
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
    interaction: ChatInputCommandInteraction,
    amount: number,
): Promise<boolean> {
    if (!validateAmount(amount)) {
        await amountErrorEmbed(interaction);
        return true;
    }
    return false;
}

export async function isSelfTransfer(
    interaction: ChatInputCommandInteraction,
    userId: string,
    targetId: string,
) {
    if (userId === targetId) {
        await SameUserEmbed(interaction);
        return true;
    }
    return false;
}

export async function isBotAction(
    interaction: ChatInputCommandInteraction,
    target: User,
) {
    //? The user is already resolved in the interaction payload,
    //? no extra Discord API request is needed.
    if (target.bot) {
        await botTargetEmbed(interaction);
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
