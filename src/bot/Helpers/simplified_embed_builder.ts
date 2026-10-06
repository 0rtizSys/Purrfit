import { EmbedBuilder } from "discord.js";

import { SimpleEmbedOptions } from "../commands/types";
import type { Permission, Replier } from "../framework/types";
import { cmd } from "../framework/context";
import { BOT_NAME, Emoji, toneColor } from "../ui/theme";
import { money } from "../ui/format";

//?------------------------------------------------------------------
//? Every embed the bot sends is built here, so they share one look:
//? tone color, emoji-first title, author for personal results, and a
//? "Purrfit" footer on everything except errors.
//?------------------------------------------------------------------

export function buildEmbed(
    replier: Replier,
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
            iconURL: replier.client?.user?.displayAvatarURL?.(),
        });
    }
    if (options.timestamp) embed.setTimestamp();

    return embed;
}

export async function sendSimpleEmbed(
    replier: Replier,
    options: SimpleEmbedOptions,
): Promise<void> {
    const embed = buildEmbed(replier, options);
    //? Errors and cooldown notices are temporary: ephemeral on a slash command,
    //? removed from the channel a few seconds later in chat
    const temporary =
        options.tone === "error" ||
        options.tone === "cooldown" ||
        Boolean(options.eph);
    await replier.send(
        {
            embeds: [embed],
            files: options.files ?? [],
            components: options.components,
        },
        { temporary },
    );
}

/** Shorthand for an error embed: specific title, what happened, how to fix it */
export async function sendErrorEmbed(
    replier: Replier,
    title: string,
    description: string,
    hint?: string,
): Promise<void> {
    await sendSimpleEmbed(replier, {
        title: `${Emoji.error} ${title}`,
        description,
        hint,
        tone: "error",
    });
}

//?-------------------------------
//? Internal Error Embed Manager
//?-------------------------------

export async function internalErrorEmbed(replier: Replier) {
    await sendErrorEmbed(
        replier,
        "Something went wrong",
        "An unexpected error happened while processing your request. Nothing was changed.",
        "Try again in a moment.",
    );
}

//?---------------------------------
//? Not Enough Perms Embed Manager
//?---------------------------------

export async function notEnoughPermsEmbed(
    replier: Replier,
    permission: Permission = "admin",
) {
    await sendErrorEmbed(
        replier,
        "Missing permissions",
        permission === "owner"
            ? "Only the bot owner can use this command."
            : "You need the **Administrator** permission to use this command.",
    );
}

//?-----------------------------------
//? Amount Below 1 or Above 1 Billion
//?-----------------------------------

export async function amountErrorEmbed(replier: Replier) {
    await sendErrorEmbed(
        replier,
        "Invalid amount",
        "The amount must be between `1` and `1,000,000,000`.",
    );
}

//?-------------------------
//? Transaction went wrong
//?-------------------------

export async function transactionWentWrong(replier: Replier) {
    await sendErrorEmbed(
        replier,
        "Transaction failed",
        "The transaction could not be completed. No money was moved.",
        "Try again in a moment.",
    );
}

//?--------------------
//? Insuficients funds
//?--------------------

const FUNDS_SOURCE = {
    withdraw: {
        label: "Bank",
        hint: (r: Replier) => `Check it with ${cmd(r, "bank_balance")}.`,
    },
    deposit: {
        label: "Wallet",
        hint: (r: Replier) => `Earn more with ${cmd(r, "work")}.`,
    },
    transfer: {
        label: "Bank",
        hint: (r: Replier) =>
            `Transfers come from your bank. Use ${cmd(r, "deposit")} first.`,
    },
    spend: {
        label: "Wallet",
        hint: (r: Replier) => `Earn more with ${cmd(r, "work")}.`,
    },
} as const;

export async function InsuficientsFundsEmbed(
    replier: Replier,
    currentBalance: number,
    currentAmount: number,
    symbol: string,
    type: "withdraw" | "deposit" | "transfer" | "spend",
) {
    const source = FUNDS_SOURCE[type];
    await sendSimpleEmbed(replier, {
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
        hint: source.hint(replier),
        tone: "error",
    });
}

//?------------------
//?  Same User Error
//?------------------

export async function SameUserEmbed(replier: Replier) {
    await sendErrorEmbed(
        replier,
        "You can't pay yourself",
        "Pick another member to send money to.",
        `To move money between your wallet and bank, use ${cmd(replier, "deposit")} or ${cmd(replier, "withdraw")}.`,
    );
}

//?-------------------
//?  Bot Target Embed
//?-------------------

export async function botTargetEmbed(replier: Replier) {
    await sendErrorEmbed(
        replier,
        "Bots can't hold money",
        "Pick a human member instead.",
    );
}
