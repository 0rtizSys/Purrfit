import type { PrefixCommand } from "../../../framework/types";
import { getEcoSymbol } from "../../../services/database/repository/servers/get_eco_symbol";

import {
    sendSimpleEmbed,
    sendErrorEmbed,
} from "../../../Helpers/simplified_embed_builder";

import { setEcoSymbol } from "../../../services/database/repository/servers/set_eco_symbol";
import { Emoji } from "../../../ui/theme";

//? Symbols are rendered inside inline code and messages, so block characters
//? that break formatting or could build mentions
const FORBIDDEN_SYMBOL_CHARS = /[`*_~|\\<>@]/;

export const setEconomySymbolAdmin: PrefixCommand = {
    name: "set_economy_symbol",
    aliases: ["setsymbol"],
    description: "Set the currency symbol of this server",
    permission: "admin",
    args: [
        {
            name: "symbol",
            kind: "word",
            description: "1 or 2 characters, like $ or 🪙",
        },
    ],

    async execute(ctx) {
        const guildId = ctx.guildId;
        const newSymbol = ctx.args.string("symbol").trim();
        if (
            [...newSymbol].length > 2 ||
            newSymbol.length === 0 ||
            FORBIDDEN_SYMBOL_CHARS.test(newSymbol)
        ) {
            await sendErrorEmbed(
                ctx,
                "Invalid symbol",
                "The symbol must be 1 or 2 characters and cannot contain markdown or mention characters (`` ` * _ ~ | \\ < > @ ``).",
            );
            return;
        }
        const oldSymbol = await getEcoSymbol(guildId);
        if (!(await setEcoSymbol(guildId, newSymbol)))
            throw new Error("Failure on function setEcoSymbol");
        await sendSimpleEmbed(ctx, {
            title: `${Emoji.settings} Currency symbol updated`,
            description: `\`${oldSymbol}\` → \`${newSymbol}\``,
            author: ctx.user,
            tone: "admin",
            timestamp: true,
        });
    },
};
