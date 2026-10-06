import type {
    ActionRowBuilder,
    AttachmentBuilder,
    ButtonBuilder,
    Client,
    EmbedBuilder,
    Guild,
    Message,
    User,
} from "discord.js";
import type { ParsedArgs } from "./args";

//?------------------------------------------------------------------
//? Prefix commands (`$>work`). Only /help, /dashboard and /support are
//? still slash commands (see commands/types.ts).
//?------------------------------------------------------------------

/** Who may run a command. Checked once, by the dispatcher, before it runs. */
export type Permission = "everyone" | "admin" | "owner";

export type ArgKind =
    //? A mention (`<@id>`) or a raw user id
    | "user"
    //? Whole number; `1,000` and `1_000` are accepted
    | "integer"
    //? Whole number that also accepts `1k`, `2.5m`, `1b`
    | "amount"
    //? Decimal number; `2.5`, `2,5` and `2.5%` are accepted
    | "number"
    //? One token, as typed
    | "word"
    //? Everything that is left, joined by single spaces (must be the last arg)
    | "text"
    //? One of `choices`, case-insensitive
    | "choice";

export type ArgSpec = {
    name: string;
    kind: ArgKind;
    description: string;
    /** Optional args must come last. */
    optional?: boolean;
    /** Bounds for `integer`, `amount` and `number`. */
    min?: number;
    max?: number;
    /** Required for `choice`. */
    choices?: readonly string[];
};

export type Executor = (ctx: CommandContext) => Promise<void>;

export type PrefixSubcommand = {
    name: string;
    aliases?: readonly string[];
    description: string;
    args?: readonly ArgSpec[];
    execute: Executor;
};

/**
 * A command is either a single action (`args` + `execute`) or a group of
 * subcommands (`subcommands`), never both.
 */
export type PrefixCommand = {
    /** Canonical name: used in logs, rate limits and the docs. */
    name: string;
    aliases?: readonly string[];
    description: string;
    /** Default: everyone. */
    permission?: Permission;
    args?: readonly ArgSpec[];
    execute?: Executor;
    subcommands?: readonly PrefixSubcommand[];
};

export type CommandCategory = {
    id: string;
    title: string;
    commands: readonly PrefixCommand[];
};

//?------------------------------------------------------------------
//? Replying
//?------------------------------------------------------------------

export type ReplyPayload = {
    embeds: EmbedBuilder[];
    files?: AttachmentBuilder[];
    components?: ActionRowBuilder<ButtonBuilder>[];
};

/**
 * Anything that can answer a user: a chat message (prefix commands) or a slash
 * interaction (/help...). The embed helpers only know this interface.
 */
export interface Replier {
    readonly client: Client;
    /** The server's prefix, used by the hints ("use `$>deposit`..."). */
    readonly prefix: string;
    /**
     * `temporary` replies are errors and notices: a slash reply is ephemeral,
     * a chat reply is deleted a few seconds later.
     */
    send(payload: ReplyPayload, options: { temporary: boolean }): Promise<void>;
}

/** What a prefix command receives. */
export interface CommandContext extends Replier {
    readonly message: Message<true>;
    readonly user: User;
    readonly guild: Guild;
    readonly guildId: string;
    /** Canonical command name. */
    readonly command: string;
    /** Canonical subcommand name, or null. */
    readonly subcommand: string | null;
    readonly args: ParsedArgs;
    /** The author has the Administrator permission here (the owner counts). */
    readonly isAdmin: boolean;
    /** Shows "typing…" while a slow command works (the chat way of deferring). */
    defer(): Promise<void>;
}
