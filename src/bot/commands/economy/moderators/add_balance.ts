import {
    SlashCommandBuilder,
    SlashCommandOptionsOnlyBuilder,
    ChatInputCommandInteraction,
    PermissionFlagsBits,
    MessageFlags,
} from "discord.js";

import { addBalance } from "../../../services/database/repository/clients/manager";

import {
    sendSimpleEmbed,
    internalErrorEmbed,
    notEnoughPermsEmbed,
    sendErrorEmbed,
} from "../../../Helpers/simplified_embed_builder";

import { requireGuild } from "../../../Helpers/require_guild";
import { getEcoSymbol } from "../../../services/database/repository/servers/get_eco_symbol";
import { logger } from "../../../services/logger";
import { Emoji } from "../../../ui/theme";
import { headline, money, moneyText } from "../../../ui/format";

export interface Command {
    data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
    execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

export const addBalanceCommand: Command = {
    data: new SlashCommandBuilder()
        .setName("add_balance")
        .setDescription("Add money to a member's wallet or bank")
        //? Hidden from non-admins in Discord; the runtime check below still applies
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption((opt) =>
            opt
                .setName("method")
                .setDescription("Where the money goes")
                .setRequired(true)
                .addChoices(
                    { name: "Wallet", value: "wallet" },
                    { name: "Bank", value: "bank" },
                ),
        )
        .addIntegerOption((opt) =>
            opt
                .setName("amount")
                .setDescription("Amount of money you're adding")
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(1_000_000_000),
        )
        .addUserOption((opt) =>
            opt
                .setName("user")
                .setDescription("User to give money to")
                .setRequired(true),
        )
        .addBooleanOption((opt) =>
            opt
                .setName("visibility")
                .setDescription("Other people can see your actions"),
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!(await requireGuild(interaction))) return;
        //! Permission check first: nothing else runs for non-admins
        if (
            !interaction.memberPermissions?.has(
                PermissionFlagsBits.Administrator,
            )
        ) {
            await notEnoughPermsEmbed(interaction);
            return;
        }
        type typeMethod = "wallet" | "bank";
        const maxAmount = 1_000_000_000;
        const method = interaction.options.getString(
            "method",
            true,
        ) as typeMethod;
        const userTarget = interaction.options.getUser("user", true);
        const userTargetID = userTarget.id;
        const amount = interaction.options.getInteger("amount", true);
        const isPublic = interaction.options.getBoolean("visibility") ?? false;
        const guildId = interaction.guild!.id;
        //! IMPORTANT VALIDATIONS
        if (method !== "wallet" && method !== "bank") {
            await sendErrorEmbed(
                interaction,
                "Invalid method",
                "Choose `Wallet` or `Bank`.",
            );
            return;
        }
        if (amount <= 0 || amount > maxAmount) {
            await sendErrorEmbed(
                interaction,
                "Invalid amount",
                "The amount must be between `1` and `1,000,000,000`.",
                "Try smaller values like `1,000` or `10,000`.",
            );
            return;
        }
        if (userTarget.bot) {
            await sendErrorEmbed(
                interaction,
                "Bots can't hold money",
                "Pick a human member instead.",
            );
            return;
        }
        //? Defering the message after validating
        await interaction.deferReply({
            flags: isPublic ? undefined : MessageFlags.Ephemeral,
        });
        //? Managing DB logic -
        try {
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
            await sendSimpleEmbed(interaction, {
                author: interaction.user,
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
        } catch (error) {
            logger.error("Error en comando add_balance", { error: error });
            await internalErrorEmbed(interaction);
        }
    },
};
