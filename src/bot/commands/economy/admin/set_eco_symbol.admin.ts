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
    sendErrorEmbed,
} from "../../../Helpers/simplified_embed_builder";

import { setEcoSymbol } from "../../../services/database/repository/servers/set_eco_symbol";
import { logger } from "../../../services/logger";
import { Emoji } from "../../../ui/theme";

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
        .setDescription("Set the currency symbol of this server")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption((opt) =>
            opt
                .setName("symbol")
                .setDescription("1 or 2 characters, like $ or 🪙")
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
            await sendErrorEmbed(
                interaction,
                "Invalid symbol",
                "The symbol must be 1 or 2 characters and cannot contain markdown or mention characters (`` ` * _ ~ | \\ < > @ ``).",
            );
            return;
        }
        try {
            const oldSymbol = await getEcoSymbol(guildId);
            if (!(await setEcoSymbol(guildId, newSymbol)))
                throw new Error("Failure on function setEcoSymbol");
            await sendSimpleEmbed(interaction, {
                title: `${Emoji.settings} Currency symbol updated`,
                description: `\`${oldSymbol}\` → \`${newSymbol}\``,
                author: interaction.user,
                tone: "admin",
                timestamp: true,
            });
        } catch (e) {
            logger.error("Error en comando set_economy_symbol", { error: e });
            await internalErrorEmbed(interaction);
        }
    },
};
