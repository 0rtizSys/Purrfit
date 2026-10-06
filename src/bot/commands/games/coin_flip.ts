import type { PrefixCommand } from "../../framework/types";
import {
    isInvalidAmount,
    MAX_AMOUNT,
    MIN_AMOUNT,
} from "../../Helpers/validators";
import {
    InsuficientsFundsEmbed,
    sendErrorEmbed,
    sendSimpleEmbed,
} from "../../Helpers/simplified_embed_builder";
import { getEcoSymbol } from "../../services/database/repository/servers/get_eco_symbol";
import { applyWalletWager } from "../../services/database/repository/clients/wager";
import {
    CoinSide,
    isCoinSide,
    settleCoinFlip,
} from "../../services/games/coin_flip";
import { Emoji, toneColor } from "../../ui/theme";
import { headline, money, moneyChange, moneyText } from "../../ui/format";

const DEFAULT_BET = 50;

function formatSide(side: CoinSide): string {
    return side === "heads" ? "Heads" : "Tails";
}

export const coinFlipCommand: PrefixCommand = {
    name: "coinflip",
    aliases: ["cf", "flip"],
    description: "Bet wallet money by flipping a coin",
    args: [
        {
            name: "choice",
            kind: "choice",
            choices: ["heads", "tails"],
            description: "Choose one side of the coin",
        },
        {
            name: "amount",
            kind: "amount",
            optional: true,
            description: `Amount to bet from your wallet (default ${DEFAULT_BET})`,
            min: MIN_AMOUNT,
            max: MAX_AMOUNT,
        },
    ],

    async execute(ctx) {
        const guildId = ctx.guildId;
        const userId = ctx.user.id;
        const choiceOption = ctx.args.string("choice");
        const amount = ctx.args.integerOpt("amount") ?? DEFAULT_BET;

        if (!isCoinSide(choiceOption)) {
            await sendErrorEmbed(
                ctx,
                "Invalid coin side",
                "Choose `Heads` or `Tails` to play coinflip.",
            );
            return;
        }

        if (await isInvalidAmount(ctx, amount)) return;

        await ctx.defer();

        const symbol = await getEcoSymbol(guildId);
        const outcome = settleCoinFlip(choiceOption, amount);
        const wager = await applyWalletWager(
            userId,
            guildId,
            outcome.amount,
            outcome.balanceDelta,
        );

        if (!wager.ok) {
            await InsuficientsFundsEmbed(
                ctx,
                wager.currentBalance,
                amount,
                symbol,
                "spend",
            );
            return;
        }

        const delta = outcome.won ? outcome.amount : -outcome.amount;
        await sendSimpleEmbed(ctx, {
            author: ctx.user,
            title: outcome.won
                ? `${Emoji.coin} You won!`
                : `${Emoji.coin} You lost`,
            description: `You picked **${formatSide(outcome.choice)}** · the coin landed on **${formatSide(outcome.result)}**\n${headline(`${delta >= 0 ? "+" : "-"}${moneyText(symbol, Math.abs(delta))}`)}`,
            tone: "success",
            //? A lost bet is a normal result, not an error: only the color
            //? changes, so it stays public and keeps the footer
            color: outcome.won ? undefined : toneColor("error"),
            fields: [
                {
                    name: "Bet",
                    value: money(symbol, outcome.amount),
                    inline: true,
                },
                {
                    name: `${Emoji.wallet} Wallet`,
                    value: moneyChange(
                        symbol,
                        wager.previousBalance,
                        wager.newBalance,
                    ),
                    inline: true,
                },
            ],
        });
    },
};
