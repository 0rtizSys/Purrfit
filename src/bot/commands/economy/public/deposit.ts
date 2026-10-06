import type { PrefixCommand } from "../../../framework/types";

import {
    isInvalidAmount,
    MAX_AMOUNT,
    MIN_AMOUNT,
} from "../../../Helpers/validators";

import { getEcoSymbol } from "../../../services/database/repository/servers/get_eco_symbol";

import {
    InsuficientsFundsEmbed,
    sendSimpleEmbed,
} from "../../../Helpers/simplified_embed_builder";

import { transferInternalSafe } from "../../../services/database/repository/clients/withdraw-transfer";
import { Emoji } from "../../../ui/theme";
import { headline, moneyText } from "../../../ui/format";

export const depositCommand: PrefixCommand = {
    name: "deposit",
    aliases: ["dep", "d"],
    description: "Move money from your wallet to your bank",
    args: [
        {
            name: "amount",
            kind: "amount",
            description: "Amount to deposit",
            min: MIN_AMOUNT,
            max: MAX_AMOUNT,
        },
    ],

    async execute(ctx) {
        const amount = ctx.args.integer("amount");
        const userId = ctx.user.id;
        const guildId = ctx.guildId;
        if (await isInvalidAmount(ctx, amount)) return;
        //? Show "typing…" before touching the DB: it can be slow
        await ctx.defer();
        const ecoSymbol = await getEcoSymbol(guildId);
        //? The balance check happens inside the transaction, under a row lock
        const result = await transferInternalSafe(
            userId,
            guildId,
            amount,
            "wallet",
            "bank",
        );
        if (!result.ok) {
            await InsuficientsFundsEmbed(
                ctx,
                result.currentBalance,
                amount,
                ecoSymbol,
                "deposit",
            );
            return;
        }
        await sendSimpleEmbed(ctx, {
            author: ctx.user,
            title: `${Emoji.bank} Deposit complete`,
            description: `${headline(moneyText(ecoSymbol, amount))}\nMoved from your ${Emoji.wallet} wallet to your ${Emoji.bank} bank.`,
            tone: "success",
            timestamp: true,
        });
    },
};
