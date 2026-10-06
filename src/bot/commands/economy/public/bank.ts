import { sendBalanceEmbed } from "../../../Helpers/balance_embed";
import type { PrefixCommand } from "../../../framework/types";

export const getBankBalance: PrefixCommand = {
    name: "bank_balance",
    aliases: ["bank", "bb"],
    description: "See your bank balance",

    async execute(ctx) {
        await sendBalanceEmbed(ctx, "bank");
    },
};
