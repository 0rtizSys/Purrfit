import {
    ActionRowBuilder,
    AttachmentBuilder,
    ButtonBuilder,
    SlashCommandBuilder,
    SlashCommandOptionsOnlyBuilder,
    SlashCommandSubcommandsOnlyBuilder,
    ChatInputCommandInteraction,
    User,
} from "discord.js";

import { EmbedTone } from "../ui/theme";

//? Slash commands. Only /help, /dashboard and /support still are; every other
//? command is a prefix command (see framework/types.ts).
export type Command = {
    data:
        | SlashCommandBuilder
        | SlashCommandOptionsOnlyBuilder
        | SlashCommandSubcommandsOnlyBuilder;
    execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
};
export type SimpleEmbedOptions = {
    title?: string;
    description?: string;
    //? Color + meaning of the embed (default "brand"); "error" is always ephemeral
    tone?: EmbedTone;
    //? Temporary: ephemeral on a slash command, deleted a few seconds later in chat
    eph?: boolean;
    fields?: { name: string; value: string; inline?: boolean }[];
    //? Shows the user's name and avatar at the top
    author?: User;
    //? Extra "💡" line explaining how to fix an error
    hint?: string;
    //? Adds the send time next to the footer (transactions)
    timestamp?: boolean;
    thumbnail?: string | null;
    image?: string;
    files?: AttachmentBuilder[];
    //? Overrides the tone color (e.g. green/red chart trend)
    color?: number;
    //? Link buttons and the like
    components?: ActionRowBuilder<ButtonBuilder>[];
};
