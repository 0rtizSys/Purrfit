import type { PrefixCommand } from "../../../framework/types";

import {
    isInvalidAmount,
    isSelfTransfer,
    isBotAction,
    MAX_AMOUNT,
    MIN_AMOUNT,
} from "../../../Helpers/validators";

import {
    InsuficientsFundsEmbed,
    sendSimpleEmbed,
} from "../../../Helpers/simplified_embed_builder";

import { transferSafe } from "../../../services/database/repository/clients/transaction";

import { getEcoSymbol } from "../../../services/database/repository/servers/get_eco_symbol";

import { Emoji } from "../../../ui/theme";
import { headline, money, moneyText } from "../../../ui/format";

export const transferCommand: PrefixCommand = {
    name: "transfer",
    aliases: ["pay", "send"],
    description: "Send money from your bank to another member",
    args: [
        {
            name: "user",
            kind: "user",
            description: "Member who receives the money",
        },
        {
            name: "amount",
            kind: "amount",
            description: "Amount to transfer",
            min: MIN_AMOUNT,
            max: MAX_AMOUNT,
        },
    ],

    async execute(ctx) {
        const guildId = ctx.guildId;
        const userId = ctx.user.id;
        const target = ctx.args.user("user");
        const targetId = target.id;
        const amount = ctx.args.integer("amount");
        //? Input checks need no DB, so they run before the defer
        if (await isSelfTransfer(ctx, userId, targetId)) return;
        if (await isBotAction(ctx, target)) return;
        if (await isInvalidAmount(ctx, amount)) return;
        await ctx.defer();
        const symbol = await getEcoSymbol(guildId);
        //? The balance check happens inside the transaction, under a row lock
        const result = await transferSafe(userId, targetId, guildId, amount);
        if (!result.ok) {
            await InsuficientsFundsEmbed(
                ctx,
                result.currentBalance,
                amount,
                symbol,
                "transfer",
            );
            return;
        }
        const fields = [
            { name: "From", value: `${ctx.user}`, inline: true },
            { name: "To", value: `${target}`, inline: true },
        ];
        if (result.tax > 0) {
            fields.push(
                {
                    name: `${Emoji.tax} Tax`,
                    value: money(symbol, result.tax),
                    inline: true,
                },
                {
                    name: "Received",
                    value: money(symbol, result.received),
                    inline: true,
                },
            );
        }
        await sendSimpleEmbed(ctx, {
            author: ctx.user,
            title: `${Emoji.transfer} Transfer complete`,
            description: headline(moneyText(symbol, amount)),
            fields,
            tone: "success",
            timestamp: true,
        });
    },
};
