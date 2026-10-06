import { sendBalanceEmbed } from "../../../Helpers/balance_embed";
import type { PrefixCommand } from "../../../framework/types";

export const getWalletBalance: PrefixCommand = {
    name: "wallet_balance",
    aliases: ["wallet", "bal", "balance"],
    description: "See your wallet balance",

    async execute(ctx) {
        //? Errors are logged and answered by the dispatcher
        await sendBalanceEmbed(ctx, "wallet");
    },
};
