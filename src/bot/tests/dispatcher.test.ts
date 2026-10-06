import { PermissionFlagsBits, type Message } from "discord.js";
import { handleMessage, type DispatchDeps } from "../framework/dispatcher";
import { buildRegistry } from "../framework/registry";
import type { PrefixCommand } from "../framework/types";

jest.mock("../services/logger", () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    },
}));
import { logger } from "../services/logger";

type FakeOptions = {
    content: string;
    admin?: boolean;
    authorId?: string;
    bot?: boolean;
    canSend?: boolean;
    canEmbed?: boolean;
};

const BOT_ID = "900000000000000000";

function fakeMessage(options: FakeOptions) {
    const { canSend = true, canEmbed = true } = options;
    const sent = { delete: jest.fn().mockResolvedValue(undefined) };
    const allowed = new Set<bigint>();
    if (canSend) allowed.add(PermissionFlagsBits.SendMessages);
    if (canEmbed) allowed.add(PermissionFlagsBits.EmbedLinks);
    const message = {
        author: {
            id: options.authorId ?? "100000000000000001",
            bot: options.bot ?? false,
        },
        webhookId: null,
        content: options.content,
        guildId: "guild-1",
        createdTimestamp: Date.now(),
        inGuild: () => true,
        guild: { id: "guild-1", members: { me: { id: BOT_ID } } },
        channel: {
            isThread: () => false,
            permissionsFor: () => ({
                has: (flag: bigint) => allowed.has(flag),
            }),
            sendTyping: jest.fn().mockResolvedValue(undefined),
        },
        member: {
            permissions: {
                has: (flag: bigint) =>
                    Boolean(options.admin) &&
                    flag === PermissionFlagsBits.Administrator,
            },
        },
        mentions: { users: new Map() },
        client: {
            user: {
                id: BOT_ID,
                displayAvatarURL: () => "https://bot/avatar.png",
            },
            users: { fetch: jest.fn().mockRejectedValue(new Error("unknown")) },
            ws: { ping: 42 },
        },
        reply: jest.fn().mockResolvedValue(sent),
    };
    return { message: message as unknown as Message, raw: message, sent };
}

const run = jest.fn(async () => undefined);
const adminRun = jest.fn(async () => undefined);
const ownerRun = jest.fn(async () => undefined);
const buyRun = jest.fn(async () => undefined);

const commands: PrefixCommand[] = [
    {
        name: "work",
        aliases: ["w"],
        description: "x",
        execute: run,
    },
    {
        name: "transfer",
        description: "x",
        args: [
            {
                name: "amount",
                kind: "amount",
                description: "x",
                min: 1,
                max: 1000,
            },
        ],
        execute: run,
    },
    {
        name: "set_tax_rate",
        permission: "admin",
        description: "x",
        execute: adminRun,
    },
    { name: "sync", permission: "owner", description: "x", execute: ownerRun },
    {
        name: "crypto",
        description: "x",
        subcommands: [
            { name: "market", description: "x", execute: run },
            {
                name: "buy",
                aliases: ["b"],
                description: "x",
                args: [{ name: "coin", kind: "word", description: "x" }],
                execute: buyRun,
            },
        ],
    },
    {
        name: "boom",
        description: "x",
        execute: async () => {
            throw new Error("boom");
        },
    },
];

function makeDeps(overrides: Partial<DispatchDeps> = {}): DispatchDeps {
    return {
        registry: buildRegistry(commands),
        getPrefix: jest.fn().mockResolvedValue("$>"),
        rateLimiter: { check: jest.fn().mockReturnValue({ allowed: true }) },
        ownerId: "owner-1",
        temporaryMs: 5,
        ...overrides,
    };
}

function embedTitle(raw: { reply: jest.Mock }, call = 0): string | undefined {
    const payload = raw.reply.mock.calls[call]?.[0] as {
        embeds?: { toJSON(): { title?: string; description?: string } }[];
    };
    return payload?.embeds?.[0]?.toJSON().title;
}

beforeEach(() => jest.clearAllMocks());

describe("message dispatcher: what it ignores", () => {
    it("does nothing for bots, other text, unknown commands and an empty prefix-only message", async () => {
        for (const options of [
            { content: "$>work", bot: true },
            { content: "work" },
            { content: "hello $>work" },
            { content: "$>nope" },
            { content: "$>" },
            { content: "" },
        ]) {
            const { message, raw } = fakeMessage(options);
            await handleMessage(message, makeDeps());
            expect(raw.reply).not.toHaveBeenCalled();
        }
        expect(run).not.toHaveBeenCalled();
    });

    it("never throws, even if the prefix lookup explodes", async () => {
        const { message } = fakeMessage({ content: "$>work" });
        const deps = makeDeps({
            getPrefix: jest.fn().mockRejectedValue(new Error("db")),
        });
        await expect(handleMessage(message, deps)).resolves.toBeUndefined();
        expect(logger.warn).toHaveBeenCalled();
    });
});

describe("message dispatcher: running commands", () => {
    it("runs a command by name, alias, any case and with a space after the prefix", async () => {
        for (const content of [
            "$>work",
            "$>w",
            "$>WORK",
            "$> work",
            "$>work   ",
        ]) {
            const { message } = fakeMessage({ content });
            await handleMessage(message, makeDeps());
        }
        expect(run).toHaveBeenCalledTimes(5);
    });

    it("rate-limits by the canonical name, so an alias shares the cooldown", async () => {
        const deps = makeDeps();
        const { message } = fakeMessage({ content: "$>w", authorId: "u-7" });
        await handleMessage(message, deps);
        expect(deps.rateLimiter.check).toHaveBeenCalledWith("u-7", "work");
    });

    it("uses each server's own prefix", async () => {
        const deps = makeDeps({ getPrefix: jest.fn().mockResolvedValue("p!") });
        const old = fakeMessage({ content: "$>work" });
        await handleMessage(old.message, deps);
        expect(run).not.toHaveBeenCalled();
        const custom = fakeMessage({ content: "p!work" });
        await handleMessage(custom.message, deps);
        expect(run).toHaveBeenCalledTimes(1);
        expect(deps.getPrefix).toHaveBeenCalledWith("guild-1");
    });

    it("hands the command a context with typed arguments", async () => {
        const { message } = fakeMessage({ content: "$>transfer 1.5k" });
        let seen: number | undefined;
        const registry = buildRegistry([
            {
                name: "transfer",
                description: "x",
                args: [{ name: "amount", kind: "amount", description: "x" }],
                execute: async (ctx) => {
                    seen = ctx.args.integer("amount");
                    expect(ctx.command).toBe("transfer");
                    expect(ctx.guildId).toBe("guild-1");
                    expect(ctx.prefix).toBe("$>");
                },
            },
        ]);
        await handleMessage(message, makeDeps({ registry }));
        expect(seen).toBe(1500);
    });

    it("tells the heartbeat a command is running", async () => {
        const onCommand = jest.fn();
        const { message } = fakeMessage({ content: "$>work" });
        await handleMessage(message, makeDeps({ onCommand }));
        expect(onCommand).toHaveBeenCalledTimes(1);
    });
});

describe("message dispatcher: subcommands", () => {
    it("routes to a subcommand by name or alias", async () => {
        for (const content of ["$>crypto buy PURR", "$>crypto b PURR"]) {
            const { message } = fakeMessage({ content });
            await handleMessage(message, makeDeps());
        }
        expect(buyRun).toHaveBeenCalledTimes(2);
    });

    it("lists the options when the subcommand is missing or unknown", async () => {
        for (const content of ["$>crypto", "$>crypto nope"]) {
            const { message, raw } = fakeMessage({ content });
            await handleMessage(message, makeDeps());
            expect(embedTitle(raw)).toContain("Choose an option");
        }
        expect(buyRun).not.toHaveBeenCalled();
    });
});

describe("message dispatcher: errors are answered, not thrown", () => {
    it("explains a usage error with the right usage line and runs nothing", async () => {
        const { message, raw } = fakeMessage({ content: "$>transfer" });
        await handleMessage(message, makeDeps());
        expect(run).not.toHaveBeenCalled();
        expect(embedTitle(raw)).toContain("Invalid usage");
        const description = JSON.stringify(
            (
                raw.reply.mock.calls[0][0] as {
                    embeds: { toJSON(): unknown }[];
                }
            ).embeds[0].toJSON(),
        );
        expect(description).toContain("$>transfer <amount>");
    });

    it("answers a failing command with a generic error and logs it", async () => {
        const { message, raw } = fakeMessage({ content: "$>boom" });
        await handleMessage(message, makeDeps());
        expect(embedTitle(raw)).toContain("Something went wrong");
        expect(logger.error).toHaveBeenCalled();
    });

    it("removes temporary replies (errors) after a moment", async () => {
        const { message, sent } = fakeMessage({ content: "$>transfer" });
        await handleMessage(message, makeDeps());
        await new Promise((resolve) => setTimeout(resolve, 30));
        expect(sent.delete).toHaveBeenCalled();
    });

    it("keeps normal replies", async () => {
        const { message, sent } = fakeMessage({ content: "<@" + BOT_ID + ">" });
        await handleMessage(message, makeDeps());
        await new Promise((resolve) => setTimeout(resolve, 30));
        expect(sent.delete).not.toHaveBeenCalled();
    });

    it("never pings anyone from a reply", async () => {
        const { message, raw } = fakeMessage({ content: "$>transfer" });
        await handleMessage(message, makeDeps());
        expect(raw.reply.mock.calls[0][0]).toEqual(
            expect.objectContaining({
                allowedMentions: { parse: [], repliedUser: false },
                failIfNotExists: false,
            }),
        );
    });
});

describe("message dispatcher: permissions", () => {
    it("admin commands do nothing for non-admins", async () => {
        const { message, raw } = fakeMessage({
            content: "$>set_tax_rate",
            admin: false,
        });
        await handleMessage(message, makeDeps());
        expect(adminRun).not.toHaveBeenCalled();
        expect(embedTitle(raw)).toContain("Missing permissions");
    });

    it("admin commands run for admins", async () => {
        const { message } = fakeMessage({
            content: "$>set_tax_rate",
            admin: true,
        });
        await handleMessage(message, makeDeps());
        expect(adminRun).toHaveBeenCalledTimes(1);
    });

    it("owner commands are for OWNER_ID only, not even for admins", async () => {
        const admin = fakeMessage({ content: "$>sync", admin: true });
        await handleMessage(admin.message, makeDeps());
        expect(ownerRun).not.toHaveBeenCalled();
        expect(embedTitle(admin.raw)).toContain("Missing permissions");

        const owner = fakeMessage({ content: "$>sync", authorId: "owner-1" });
        await handleMessage(owner.message, makeDeps());
        expect(ownerRun).toHaveBeenCalledTimes(1);
    });

    it("owner commands are refused when OWNER_ID is not configured", async () => {
        const { message } = fakeMessage({
            content: "$>sync",
            authorId: "undefined",
        });
        await handleMessage(message, makeDeps({ ownerId: undefined }));
        expect(ownerRun).not.toHaveBeenCalled();
    });
});

describe("message dispatcher: rate limit and channel permissions", () => {
    it("answers a rate-limited user with a cooldown notice and runs nothing", async () => {
        const deps = makeDeps({
            rateLimiter: {
                check: jest
                    .fn()
                    .mockReturnValue({ allowed: false, retryAfterMs: 3000 }),
            },
        });
        const { message, raw } = fakeMessage({ content: "$>work" });
        await handleMessage(message, deps);
        expect(run).not.toHaveBeenCalled();
        expect(embedTitle(raw)).toContain("Slow down");
    });

    it("stays silent where the bot can't send messages", async () => {
        const { message, raw } = fakeMessage({
            content: "$>work",
            canSend: false,
        });
        await handleMessage(message, makeDeps());
        expect(raw.reply).not.toHaveBeenCalled();
        expect(run).not.toHaveBeenCalled();
    });

    it("falls back to plain text where it can't embed links", async () => {
        const { message, raw } = fakeMessage({
            content: "$>work",
            canEmbed: false,
        });
        await handleMessage(message, makeDeps());
        expect(run).not.toHaveBeenCalled();
        expect(raw.reply.mock.calls[0][0]).toEqual(
            expect.objectContaining({
                content: expect.stringContaining("Embed Links"),
            }),
        );
    });
});

describe("message dispatcher: mentioning the bot", () => {
    it("tells the prefix of the server", async () => {
        for (const content of [`<@${BOT_ID}>`, `<@!${BOT_ID}>`]) {
            const { message, raw } = fakeMessage({ content });
            await handleMessage(
                message,
                makeDeps({ getPrefix: jest.fn().mockResolvedValue("p!") }),
            );
            expect(embedTitle(raw)).toContain("Purrfit");
            expect(
                JSON.stringify(raw.reply.mock.calls[0][0].embeds[0].toJSON()),
            ).toContain("p!");
        }
    });

    it("is rate limited too", async () => {
        const deps = makeDeps({
            rateLimiter: {
                check: jest
                    .fn()
                    .mockReturnValue({ allowed: false, retryAfterMs: 1000 }),
            },
        });
        const { message, raw } = fakeMessage({ content: `<@${BOT_ID}>` });
        await handleMessage(message, deps);
        expect(embedTitle(raw)).toContain("Slow down");
    });
});
