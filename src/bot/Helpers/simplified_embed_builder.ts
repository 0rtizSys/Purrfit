import { embColor, errorIcon, successIcon } from "../configs/exporter";

import {
    EmbedBuilder,
    ChatInputCommandInteraction,
    MessageFlags,
} from "discord.js";

import { SimpleEmbedOptions } from "../commands/types";

export async function sendSimpleEmbed(
    interaction: ChatInputCommandInteraction,
    options: SimpleEmbedOptions,
): Promise<void> {
    const embed = new EmbedBuilder().setColor(embColor);

    if (options.title) {
        embed.setTitle(options.title);
    }
    if (options.description) {
        embed.setDescription(options.description);
    }

    if (options.thumType === "error") {
        embed.setThumbnail(errorIcon);
    } else if (options.thumType === "success") {
        embed.setThumbnail(successIcon);
    }

    if (options.fields) {
        embed.addFields(options.fields);
    }

    if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ embeds: [embed] });
    } else {
        await interaction.reply({
            embeds: [embed],
            flags: options.eph ? MessageFlags.Ephemeral : undefined,
        });
    }
}

//?-------------------------------
//? Internal Error Embed Manager
//?-------------------------------

export async function internalErrorEmbed(
    interaction: ChatInputCommandInteraction,
) {
    const embed = new EmbedBuilder()
        .setColor(embColor)
        .setTitle("✖️ Something went wrong")
        .setDescription(
            "An unexpected error occurred while processing your request.\nPlease try again in a moment 💡",
        )
        .setThumbnail(errorIcon);

    if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ embeds: [embed] });
    } else {
        await interaction.reply({
            embeds: [embed],
            flags: MessageFlags.Ephemeral,
        });
    }
}

//?---------------------------------
//? Not Enough Perms Embed Manager
//?---------------------------------

export async function notEnoughPermsEmbed(
    interaction: ChatInputCommandInteraction,
) {
    const embed = new EmbedBuilder()
        .setColor(embColor)
        .setTitle("✖️ Error")
        .setDescription("Purrfit: You dont have enough perms to do that!")
        .setThumbnail(errorIcon);

    if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ embeds: [embed] });
    } else {
        await interaction.reply({
            embeds: [embed],
            flags: MessageFlags.Ephemeral,
        });
    }
}

//?-----------------------------------
//? Amount Below 0 or Above 1 Million
//?-----------------------------------

export async function amountErrorEmbed(
    interaction: ChatInputCommandInteraction,
) {
    const embed = new EmbedBuilder()
        .setColor(embColor)
        .setTitle("✖️ Error")
        .setDescription(
            "Amount cannot be below \`1\` or above \`1,000,000,000\`",
        )
        .setThumbnail(errorIcon);

    if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ embeds: [embed] });
    } else {
        await interaction.reply({
            embeds: [embed],
            flags: MessageFlags.Ephemeral,
        });
    }
}

//?-------------------------
//? Transaction went wrong
//?-------------------------

export async function transactionWentWrong(
    interaction: ChatInputCommandInteraction,
) {
    const embed = new EmbedBuilder()
        .setColor(embColor)
        .setTitle("✖️ Transaction went wrong")
        .setDescription(
            "An unexpected error occurred while processing your request.\nPlease try again in a moment 💡",
        )
        .setThumbnail(errorIcon);
    if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ embeds: [embed] });
    } else {
        await interaction.reply({
            embeds: [embed],
            flags: MessageFlags.Ephemeral,
        });
    }
}

//?--------------------
//? Insuficients funds
//?--------------------

export async function InsuficientsFundsEmbed(
    interaction: ChatInputCommandInteraction,
    currentBalance: number,
    currentAmount: number,
    symbol: string,
    type: "withdraw" | "deposit" | "transfer",
) {
    const embed = new EmbedBuilder()
        .setColor(embColor)
        .setTitle("✖️ Insufficient funds")
        .setDescription(
            `Current balance: \`${symbol} ${currentBalance}\` \nAmount to ${type}: \`${symbol} ${currentAmount}\``,
        )
        .setThumbnail(errorIcon);
    if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ embeds: [embed] });
    } else {
        await interaction.reply({
            embeds: [embed],
            flags: MessageFlags.Ephemeral,
        });
    }
}

//?------------------
//?  Same User Error
//?------------------

export async function SameUserEmbed(interaction: ChatInputCommandInteraction) {
    const embed = new EmbedBuilder()
        .setColor(embColor)
        .setTitle("✖️ Error")
        .setDescription(`Purrfit: Oops, you cant transfer yourself balance!`)
        .setThumbnail(errorIcon);
    if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ embeds: [embed] });
    } else {
        await interaction.reply({
            embeds: [embed],
            flags: MessageFlags.Ephemeral,
        });
    }
}

//?-------------------
//?  Bot Target Embed
//?-------------------

export async function botTargetEmbed(interaction: ChatInputCommandInteraction) {
    const embed = new EmbedBuilder()
        .setColor(embColor)
        .setTitle("✖️ Error")
        .setDescription(`Purrfit: Oops, you cant transfer balance to a bot!`)
        .setThumbnail(errorIcon);
    if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ embeds: [embed] });
    } else {
        await interaction.reply({
            embeds: [embed],
            flags: MessageFlags.Ephemeral,
        });
    }
}
