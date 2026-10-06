import { ParsedArgs } from "../../framework/args";
import type { CommandContext } from "../../framework/types";

//? A stand-in for the context a prefix command receives, for unit tests.
//?
//?   const { ctx, replies } = fakeCtx({ args: { amount: 500 } });
//?   await depositCommand.execute!(ctx);
//?   expect(replies()[0].embed.title).toContain("Deposit");
//?
//? `args` maps argument names to the values the parser would have produced
//? (a user argument is any `{ id, bot }` object).

export type FakeCtxOptions = {
    args?: Record<string, unknown>;
    isAdmin?: boolean;
    userId?: string;
    guildId?: string;
    prefix?: string;
    command?: string;
    subcommand?: string | null;
};

export type SentReply = {
    embed: {
        title?: string;
        description?: string;
        color?: number;
        fields?: { name: string; value: string; inline?: boolean }[];
        footer?: { text: string };
    };
    /** Errors, cooldown notices and `eph` replies are temporary. */
    temporary: boolean;
    files: unknown[];
};

export function fakeUser(id: string, bot = false) {
    return {
        id,
        bot,
        username: `user-${id}`,
        displayName: `user-${id}`,
        displayAvatarURL: () => "https://cdn.example/avatar.png",
        toString: () => `<@${id}>`,
    };
}

export function fakeCtx(options: FakeCtxOptions = {}) {
    const userId = options.userId ?? "user-1";
    const guildId = options.guildId ?? "guild-1";
    const send = jest.fn().mockResolvedValue(undefined);
    const ctx = {
        client: {
            user: { displayAvatarURL: () => "https://cdn.example/bot.png" },
            ws: { ping: 42 },
        },
        prefix: options.prefix ?? "$>",
        send,
        message: { createdTimestamp: Date.now() },
        user: fakeUser(userId),
        guild: { id: guildId },
        guildId,
        command: options.command ?? "test",
        subcommand: options.subcommand ?? null,
        args: new ParsedArgs(new Map(Object.entries(options.args ?? {}))),
        isAdmin: options.isAdmin ?? false,
        defer: jest.fn().mockResolvedValue(undefined),
    } as unknown as CommandContext;

    /** Every reply the command sent, with its embed already serialized. */
    const replies = (): SentReply[] =>
        send.mock.calls.map(
            ([payload, opts]: [
                {
                    embeds: { toJSON(): SentReply["embed"] }[];
                    files?: unknown[];
                },
                { temporary: boolean },
            ]) => ({
                embed: payload.embeds[0].toJSON(),
                temporary: opts.temporary,
                files: payload.files ?? [],
            }),
        );

    return { ctx, send, replies };
}
