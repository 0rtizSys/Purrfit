import { getBalance } from "../services/database/repository/clients/manager";
import { getEcoSymbol } from "../services/database/repository/servers/get_eco_symbol";
import { sendSimpleEmbed } from "./simplified_embed_builder";
import { Emoji } from "../ui/theme";
import { cmd } from "../framework/context";
import type { CommandContext } from "../framework/types";
import { headline, money, moneyText } from "../ui/format";

//? Shared by wallet_balance and bank_balance: the requested balance is the
//? headline, the other one and the total are shown below it
export async function sendBalanceEmbed(
    ctx: CommandContext,
    focus: "wallet" | "bank",
): Promise<void> {
    const guildId = ctx.guildId;
    const userId = ctx.user.id;
    const [symbol, wallet, bank] = await Promise.all([
        getEcoSymbol(guildId),
        getBalance(userId, guildId, "wallet"),
        getBalance(userId, guildId, "bank"),
    ]);
    const main = focus === "wallet" ? wallet : bank;
    const other =
        focus === "wallet"
            ? { name: `${Emoji.bank} Bank`, value: money(symbol, bank) }
            : { name: `${Emoji.wallet} Wallet`, value: money(symbol, wallet) };

    await sendSimpleEmbed(ctx, {
        author: ctx.user,
        title:
            focus === "wallet"
                ? `${Emoji.wallet} Wallet balance`
                : `${Emoji.bank} Bank balance`,
        description: headline(moneyText(symbol, main)),
        fields: [
            { ...other, inline: true },
            {
                name: `${Emoji.total} Total`,
                value: money(symbol, wallet + bank),
                inline: true,
            },
        ],
        hint:
            focus === "wallet"
                ? `Keep money safe and earning interest with ${cmd(ctx, "deposit")}.`
                : `Bank money earns daily interest. See ${cmd(ctx, "economy_info")}.`,
    });
}
