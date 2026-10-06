import {
    ChatInputCommandInteraction,
    MessageFlags,
    PermissionFlagsBits,
    type Message,
} from "discord.js";
import type { ParsedArgs } from "./args";
import type { CommandContext, ReplyPayload, Replier } from "./types";

/** How long an error or notice stays in the channel before the bot removes it. */
export const TEMPORARY_REPLY_MS = 10_000;

//? Pending deletions must not keep the process alive on shutdown
function deleteLater(message: Message, ms: number): void {
    const timer = setTimeout(() => {
        message.delete().catch(() => undefined);
    }, ms);
    timer.unref();
}

/** Answers a chat message: a reply that never pings, removed later if temporary. */
export function messageReplier(
    message: Message<true>,
    prefix: string,
    temporaryMs: number = TEMPORARY_REPLY_MS,
): Replier {
    return {
        client: message.client,
        prefix,
        async send(payload: ReplyPayload, { temporary }) {
            const sent = await message.reply({
                embeds: payload.embeds,
                files: payload.files,
                components: payload.components,
                //? Never ping the author or anybody the embed text names
                allowedMentions: { parse: [], repliedUser: false },
                //? If the user deleted their message meanwhile, still answer
                failIfNotExists: false,
            });
            if (temporary) deleteLater(sent, temporaryMs);
        },
    };
}

/** Answers a slash interaction (/help, /dashboard, /support). */
export function slashReplier(
    interaction: ChatInputCommandInteraction,
    prefix: string,
): Replier {
    return {
        client: interaction.client,
        prefix,
        async send(payload: ReplyPayload, { temporary }) {
            const body = {
                embeds: payload.embeds,
                files: payload.files,
                components: payload.components,
            };
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply(body);
            } else {
                await interaction.reply({
                    ...body,
                    flags: temporary ? MessageFlags.Ephemeral : undefined,
                });
            }
        },
    };
}

export function createContext(
    message: Message<true>,
    replier: Replier,
    parts: {
        command: string;
        subcommand: string | null;
        args: ParsedArgs;
    },
): CommandContext {
    return {
        client: replier.client,
        prefix: replier.prefix,
        send: replier.send.bind(replier),
        message,
        user: message.author,
        guild: message.guild,
        guildId: message.guildId,
        command: parts.command,
        subcommand: parts.subcommand,
        args: parts.args,
        isAdmin:
            message.member?.permissions.has(
                PermissionFlagsBits.Administrator,
            ) ?? false,
        async defer() {
            //? Purely cosmetic: a failure here must never stop the command
            await message.channel.sendTyping().catch(() => undefined);
        },
    };
}

/** `` `$>deposit` ``: a command as a hint shows it, with this server's prefix. */
export function cmd(replier: Pick<Replier, "prefix">, usage: string): string {
    return `\`${replier.prefix}${usage}\``;
}
