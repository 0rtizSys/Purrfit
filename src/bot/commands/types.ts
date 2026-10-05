import {
    AttachmentBuilder,
    SlashCommandBuilder,
    SlashCommandOptionsOnlyBuilder,
    SlashCommandSubcommandsOnlyBuilder,
    ChatInputCommandInteraction,
    User,
} from "discord.js";

import { EmbedTone } from "../ui/theme";

export type Command = {
    data:
        | SlashCommandBuilder
        | SlashCommandOptionsOnlyBuilder
        | SlashCommandSubcommandsOnlyBuilder;
    execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
};
export type Embeds = {
    interaction: ChatInputCommandInteraction;
};
export type SimpleEmbedOptions = {
    title?: string;
    description?: string;
    //? Color + meaning of the embed (default "brand"); "error" is always ephemeral
    tone?: EmbedTone;
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
};
