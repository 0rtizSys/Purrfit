import {
    SlashCommandBuilder,
    SlashCommandOptionsOnlyBuilder,
    ChatInputCommandInteraction,
    PermissionFlagsBits,
} from "discord.js";

import { requireGuild } from "../../../Helpers/require_guild";

import { getEcoSymbol } from "../../../services/database/repository/servers/get_eco_symbol";

import {
    sendSimpleEmbed,
    internalErrorEmbed,
    notEnoughPermsEmbed,
} from "../../../Helpers/simplified_embed_builder";

import { setEcoSymbol } from "../../../services/database/repository/servers/set_eco_symbol";
import { logger } from "../../../services/logger";

export interface Command {
    data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
    execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

//? Symbols are rendered inside inline code and messages, so block characters
//? that break formatting or could build mentions
const FORBIDDEN_SYMBOL_CHARS = /[`*_~|\\<>@]/;

export const setEconomySymbolAdmin: Command = {
    data: new SlashCommandBuilder()
        .setName("set_economy_symbol")
        .setDescription("set the server economy symbol")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption((opt) =>
            opt
                .setName("symbol")
                .setDescription("Symbol must be 1 or 2 digits")
                .setRequired(true)
                .setMaxLength(2),
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!(await requireGuild(interaction))) return;
        //! Permission check first: before this fix a non-admin got the error
        //! embed but the symbol was still saved (missing return)
        if (
            !interaction.memberPermissions?.has(
                PermissionFlagsBits.Administrator,
            )
        ) {
            await notEnoughPermsEmbed(interaction);
            return;
        }
        const guildId = interaction.guild!.id;
        const newSymbol = interaction.options.getString("symbol", true).trim();
        if (
            [...newSymbol].length > 2 ||
            newSymbol.length === 0 ||
            FORBIDDEN_SYMBOL_CHARS.test(newSymbol)
        ) {
            await sendSimpleEmbed(interaction, {
                title: "✖️ Error",
                description:
                    "Symbol length must be 1 or 2 digits and cannot contain markdown or mention characters",
                thumType: "error",
                eph: true,
            });
            return;
        }
        try {
            const oldSymbol = await getEcoSymbol(guildId);
            if (!(await setEcoSymbol(guildId, newSymbol)))
                throw new Error("Failure on function setEcoSymbol");
            await sendSimpleEmbed(interaction, {
                title: "⚙️ Configuration saved",
                description: `Old symbol: \`${oldSymbol}\`\nNew symbol: \`${newSymbol}\``,
                thumType: "success",
                eph: false,
            });
        } catch (e) {
            logger.error("Error en comando set_economy_symbol", { error: e });
            await internalErrorEmbed(interaction);
        }
    },
};
