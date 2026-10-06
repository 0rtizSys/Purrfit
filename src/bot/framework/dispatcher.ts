import { PermissionFlagsBits, type Message } from "discord.js";
import {
    internalErrorEmbed,
    notEnoughPermsEmbed,
    sendErrorEmbed,
    sendSimpleEmbed,
} from "../Helpers/simplified_embed_builder";
import { logger } from "../services/logger";
import type { RateLimiter } from "../services/rate_limit";
import { Emoji } from "../ui/theme";
import { relativeTime } from "../ui/format";
import { parseArgs, usageOf, type ArgResolver } from "./args";
import { createContext, messageReplier } from "./context";
import { findSubcommand, type Registry } from "./registry";
import type { ArgSpec, Executor, Permission, PrefixSubcommand } from "./types";

//?------------------------------------------------------------------
//? Turns a chat message into a command run:
//?   prefix -> command -> permission -> rate limit -> arguments -> execute
//? Every step that can fail answers with a temporary embed; a message that
//? is not a command (or names an unknown one) is ignored without a word.
//?------------------------------------------------------------------

export type DispatchDeps = {
    registry: Registry;
    getPrefix: (guildId: string) => Promise<string>;
    rateLimiter: Pick<RateLimiter, "check">;
    /** Discord id that may run `owner` commands (OWNER_ID). */
    ownerId?: string;
    /** Called when a command is about to run (the heartbeat's "last event"). */
    onCommand?: () => void;
    /** How long errors stay in the channel (default 10 s). */
    temporaryMs?: number;
};

function isAllowed(
    message: Message<true>,
    permission: Permission,
    ownerId: string | undefined,
): boolean {
    switch (permission) {
        case "everyone":
            return true;
        case "owner":
            return Boolean(ownerId) && message.author.id === ownerId;
        case "admin":
            return (
                message.member?.permissions.has(
                    PermissionFlagsBits.Administrator,
                ) ?? false
            );
    }
}

/** True when the bot may send in this channel; false means "stay quiet". */
function canAnswer(message: Message<true>): "yes" | "no-embeds" | "no" {
    const me = message.guild.members.me;
    const permissions = me ? message.channel.permissionsFor(me) : null;
    if (!permissions) return "yes";
    const send = message.channel.isThread()
        ? PermissionFlagsBits.SendMessagesInThreads
        : PermissionFlagsBits.SendMessages;
    if (!permissions.has(send)) return "no";
    return permissions.has(PermissionFlagsBits.EmbedLinks)
        ? "yes"
        : "no-embeds";
}

async function dispatch(message: Message, deps: DispatchDeps): Promise<void> {
    //? Cheapest checks first: this runs for every message of every server
    if (message.author.bot || message.webhookId || !message.inGuild()) return;
    const content = message.content;
    if (!content) return;

    const prefix = await deps.getPrefix(message.guildId);
    const botId = message.client.user?.id;
    const mentionOnly =
        botId !== undefined &&
        (content.trim() === `<@${botId}>` || content.trim() === `<@!${botId}>`);
    if (!mentionOnly && !content.startsWith(prefix)) return;

    const tokens = mentionOnly
        ? []
        : content.slice(prefix.length).trim().split(/\s+/).filter(Boolean);
    const command = tokens.length ? deps.registry.find(tokens[0]!) : undefined;
    if (!mentionOnly && !command) return;

    const answer = canAnswer(message);
    if (answer === "no") return;
    if (answer === "no-embeds") {
        await message
            .reply({
                content:
                    "I need the **Embed Links** permission in this channel to answer.",
                allowedMentions: { parse: [], repliedUser: false },
                failIfNotExists: false,
            })
            .catch(() => undefined);
        return;
    }

    const replier = messageReplier(message, prefix, deps.temporaryMs);

    const limit = deps.rateLimiter.check(
        message.author.id,
        command ? command.name : "prefix_mention",
    );
    if (!limit.allowed) {
        await sendSimpleEmbed(replier, {
            title: `${Emoji.cooldown} Slow down`,
            description: `You're using commands too fast. Try again ${relativeTime(Date.now() + limit.retryAfterMs)}.`,
            tone: "cooldown",
        }).catch(() => undefined);
        return;
    }

    if (!command) {
        await sendSimpleEmbed(replier, {
            title: `${Emoji.cat} Hi, I'm Purrfit`,
            description: `My prefix in this server is \`${prefix}\`.\nUse \`/help\` to see every command.`,
        });
        return;
    }

    const permission = command.permission ?? "everyone";
    if (!isAllowed(message, permission, deps.ownerId)) {
        await notEnoughPermsEmbed(replier, permission);
        return;
    }

    let rest = tokens.slice(1);
    let sub: PrefixSubcommand | undefined;
    let specs: readonly ArgSpec[];
    let execute: Executor;
    if (command.subcommands?.length) {
        sub = findSubcommand(command, rest[0]);
        if (!sub) {
            await sendErrorEmbed(
                replier,
                "Choose an option",
                command.subcommands
                    .map((s) => `\`${prefix}${usageOf(command, s)}\``)
                    .join("\n"),
            );
            return;
        }
        rest = rest.slice(1);
        specs = sub.args ?? [];
        execute = sub.execute;
    } else {
        specs = command.args ?? [];
        execute = command.execute!;
    }

    const resolver: ArgResolver = {
        async resolveUser(id) {
            return (
                message.mentions.users.get(id) ??
                (await message.client.users.fetch(id).catch(() => null))
            );
        },
    };
    const parsed = await parseArgs(specs, rest, resolver);
    if (!parsed.ok) {
        await sendErrorEmbed(
            replier,
            "Invalid usage",
            parsed.error,
            `Usage: \`${prefix}${usageOf(command, sub)}\``,
        );
        return;
    }

    deps.onCommand?.();
    const ctx = createContext(message, replier, {
        command: command.name,
        subcommand: sub?.name ?? null,
        args: parsed.args,
    });
    try {
        await execute(ctx);
    } catch (error) {
        logger.error(`Error ejecutando ${prefix}${command.name}`, {
            error,
            guildId: message.guildId,
        });
        //? The error reply itself can fail (missing permissions, deleted
        //? channel); that must never escape this handler
        try {
            await internalErrorEmbed(replier);
        } catch (replyError) {
            logger.warn("No se pudo responder al error", { error: replyError });
        }
    }
}

/** Never throws: a bad message must not take the bot down. */
export async function handleMessage(
    message: Message,
    deps: DispatchDeps,
): Promise<void> {
    try {
        await dispatch(message, deps);
    } catch (error) {
        logger.warn("Error procesando un mensaje", {
            error,
            guildId: message.guildId,
        });
    }
}
