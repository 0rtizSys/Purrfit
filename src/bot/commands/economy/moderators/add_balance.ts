import type { PrefixCommand } from "../../../framework/types";
import { addBalance } from "../../../services/database/repository/clients/manager";

import {
    sendSimpleEmbed,
    sendErrorEmbed,
} from "../../../Helpers/simplified_embed_builder";

import { getEcoSymbol } from "../../../services/database/repository/servers/get_eco_symbol";
import { Emoji } from "../../../ui/theme";
import { headline, money, moneyText } from "../../../ui/format";

export const addBalanceCommand: PrefixCommand = {
    name: "add_balance",
    aliases: ["addbal"],
    description: "Add money to a member's wallet or bank",
    permission: "admin",
    args: [
        {
            name: "user",
            kind: "user",
            description: "User to give money to",
        },
        {
            name: "method",
            kind: "choice",
            description: "Where the money goes",
            choices: ["wallet", "bank"],
        },
        {
            name: "amount",
            kind: "amount",
            description: "Amount of money you're adding",
            min: 1,
            max: 1_000_000_000,
        },
    ],

    async execute(ctx) {
        type typeMethod = "wallet" | "bank";
        const maxAmount = 1_000_000_000;
        const method = ctx.args.string("method") as typeMethod;
        const userTarget = ctx.args.user("user");
        const userTargetID = userTarget.id;
        const amount = ctx.args.integer("amount");
        const guildId = ctx.guildId;
        //! IMPORTANT VALIDATIONS
        if (method !== "wallet" && method !== "bank") {
            await sendErrorEmbed(
                ctx,
                "Invalid method",
                "Choose `Wallet` or `Bank`.",
            );
            return;
        }
        if (amount <= 0 || amount > maxAmount) {
            await sendErrorEmbed(
                ctx,
                "Invalid amount",
                "The amount must be between `1` and `1,000,000,000`.",
                "Try smaller values like `1,000` or `10,000`.",
            );
            return;
        }
        if (userTarget.bot) {
            await sendErrorEmbed(
                ctx,
                "Bots can't hold money",
                "Pick a human member instead.",
            );
            return;
        }
        await ctx.defer();
        //? Managing DB logic
        const symbol = await getEcoSymbol(guildId);
        const newBalance = await addBalance(
            userTargetID,
            guildId,
            method,
            amount,
        );
        const place =
            method === "wallet"
                ? `${Emoji.wallet} Wallet`
                : `${Emoji.bank} Bank`;
        await sendSimpleEmbed(ctx, {
            author: ctx.user,
            title: `${Emoji.settings} Balance added`,
            description: `${headline(`+${moneyText(symbol, amount)}`)}\nAdded to ${userTarget}'s ${method}.`,
            fields: [
                {
                    name: `${place} now`,
                    value: money(symbol, newBalance),
                    inline: true,
                },
            ],
            tone: "admin",
            timestamp: true,
        });
    },
};
