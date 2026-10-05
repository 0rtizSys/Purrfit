import {
    EmbedBuilder,
    ChatInputCommandInteraction,
    MessageFlags,
} from "discord.js";

import { SimpleEmbedOptions } from "../commands/types";
import { BOT_NAME, Emoji, toneColor } from "../ui/theme";
import { money } from "../ui/format";

//?------------------------------------------------------------------
//? Every embed the bot sends is built here, so they share one look:
//? tone color, emoji-first title, author for personal results, and a
//? "Purrfit" footer on everything except errors.
//?------------------------------------------------------------------

export function buildEmbed(
    interaction: ChatInputCommandInteraction,
    options: SimpleEmbedOptions,
): EmbedBuilder {
    const tone = options.tone ?? "brand";
    const embed = new EmbedBuilder().setColor(options.color ?? toneColor(tone));

    if (options.author) {
        embed.setAuthor({
            name: options.author.displayName ?? options.author.username,
            iconURL: options.author.displayAvatarURL?.(),
        });
    }
    if (options.title) embed.setTitle(options.title);

    const description = [
        options.description,
        options.hint && `-# ${Emoji.hint} ${options.hint}`,
    ]
        .filter(Boolean)
        .join("\n");
    if (description) embed.setDescription(description);

    if (options.fields?.length) embed.addFields(options.fields);
    if (options.thumbnail) embed.setThumbnail(options.thumbnail);
    if (options.image) embed.setImage(options.image);

    if (tone !== "error") {
        embed.setFooter({
            text: BOT_NAME,
            iconURL: interaction.client?.user?.displayAvatarURL?.(),
        });
    }
    if (options.timestamp) embed.setTimestamp();

    return embed;
}

export async function sendSimpleEmbed(
    interaction: ChatInputCommandInteraction,
    options: SimpleEmbedOptions,
): Promise<void> {
    const embed = buildEmbed(interaction, options);
    const isError = options.tone === "error";
    const wantsPrivate = isError || Boolean(options.eph);
    const files = options.files ?? [];

    if (interaction.deferred || interaction.replied) {
        //? A deferred public reply cannot become ephemeral, so an error (or a
        //? private message) after a public defer replaces it with a private
        //? follow-up instead of showing it to the whole channel
        if (wantsPrivate && interaction.deferred && !interaction.ephemeral) {
            try {
                await interaction.deleteReply();
                await interaction.followUp({
                    embeds: [embed],
                    flags: MessageFlags.Ephemeral,
                });
                return;
            } catch {
                //? Fall back to editing the public reply
            }
        }
        await interaction.editReply({ embeds: [embed], files });
    } else {
        await interaction.reply({
            embeds: [embed],
            files,
            flags: wantsPrivate ? MessageFlags.Ephemeral : undefined,
        });
    }
}

/** Shorthand for an error embed: specific title, what happened, how to fix it */
export async function sendErrorEmbed(
    interaction: ChatInputCommandInteraction,
    title: string,
    description: string,
    hint?: string,
): Promise<void> {
    await sendSimpleEmbed(interaction, {
        title: `${Emoji.error} ${title}`,
        description,
        hint,
        tone: "error",
    });
}

//?-------------------------------
//? Internal Error Embed Manager
//?-------------------------------

export async function internalErrorEmbed(
    interaction: ChatInputCommandInteraction,
) {
    await sendErrorEmbed(
        interaction,
        "Something went wrong",
        "An unexpected error happened while processing your request. Nothing was changed.",
        "Try again in a moment.",
    );
}

//?---------------------------------
//? Not Enough Perms Embed Manager
//?---------------------------------

export async function notEnoughPermsEmbed(
    interaction: ChatInputCommandInteraction,
) {
    await sendErrorEmbed(
        interaction,
        "Missing permissions",
        "You need the **Administrator** permission to use this command.",
    );
}

//?-----------------------------------
//? Amount Below 1 or Above 1 Billion
//?-----------------------------------

export async function amountErrorEmbed(
    interaction: ChatInputCommandInteraction,
) {
    await sendErrorEmbed(
        interaction,
        "Invalid amount",
        "The amount must be between `1` and `1,000,000,000`.",
    );
}

//?-------------------------
//? Transaction went wrong
//?-------------------------

export async function transactionWentWrong(
    interaction: ChatInputCommandInteraction,
) {
    await sendErrorEmbed(
        interaction,
        "Transaction failed",
        "The transaction could not be completed. No money was moved.",
        "Try again in a moment.",
    );
}

//?--------------------
//? Insuficients funds
//?--------------------

const FUNDS_SOURCE = {
    withdraw: { label: "Bank", hint: "Check it with `/bank_balance`." },
    deposit: { label: "Wallet", hint: "Earn more with `/work`." },
    transfer: {
        label: "Bank",
        hint: "Transfers come from your bank. Use `/deposit` first.",
    },
    spend: { label: "Wallet", hint: "Earn more with `/work`." },
} as const;

export async function InsuficientsFundsEmbed(
    interaction: ChatInputCommandInteraction,
    currentBalance: number,
    currentAmount: number,
    symbol: string,
    type: "withdraw" | "deposit" | "transfer" | "spend",
) {
    const source = FUNDS_SOURCE[type];
    await sendSimpleEmbed(interaction, {
        title: `${Emoji.error} Not enough money`,
        description: `You tried to ${type} ${money(symbol, currentAmount)} but you are ${money(symbol, currentAmount - currentBalance)} short.`,
        fields: [
            {
                name: source.label,
                value: money(symbol, currentBalance),
                inline: true,
            },
            {
                name: "Needed",
                value: money(symbol, currentAmount),
                inline: true,
            },
        ],
        hint: source.hint,
        tone: "error",
    });
}

//?------------------
//?  Same User Error
//?------------------

export async function SameUserEmbed(interaction: ChatInputCommandInteraction) {
    await sendErrorEmbed(
        interaction,
        "You can't pay yourself",
        "Pick another member to send money to.",
        "To move money between your wallet and bank, use `/deposit` or `/withdraw`.",
    );
}

//?-------------------
//?  Bot Target Embed
//?-------------------

export async function botTargetEmbed(interaction: ChatInputCommandInteraction) {
    await sendErrorEmbed(
        interaction,
        "Bots can't hold money",
        "Pick a human member instead.",
    );
}
