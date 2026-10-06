import type { User } from "discord.js";
import { formatArgs, parseArgs, usageOf } from "../framework/args";
import type { ArgSpec, PrefixCommand } from "../framework/types";

const bob = { id: "222222222222222222", bot: false } as User;
const resolver = {
    resolveUser: jest.fn(async (id: string) => (id === bob.id ? bob : null)),
};

async function parse(specs: ArgSpec[], input: string) {
    return parseArgs(specs, input.split(/\s+/).filter(Boolean), resolver);
}

const amount: ArgSpec = {
    name: "amount",
    kind: "amount",
    description: "x",
    min: 1,
    max: 1_000_000_000,
};

describe("parseArgs", () => {
    it("reads a mention, a raw id and an amount", async () => {
        const specs: ArgSpec[] = [
            { name: "user", kind: "user", description: "x" },
            amount,
        ];
        for (const who of [`<@${bob.id}>`, `<@!${bob.id}>`, bob.id]) {
            const result = await parse(specs, `${who} 250`);
            expect(result.ok).toBe(true);
            if (result.ok) {
                expect(result.args.user("user")).toBe(bob);
                expect(result.args.integer("amount")).toBe(250);
            }
        }
    });

    it("accepts k/m/b shorthand and separators in amounts", async () => {
        const cases: [string, number][] = [
            ["1k", 1000],
            ["1.5k", 1500],
            ["1.1k", 1100],
            ["2M", 2_000_000],
            ["1b", 1_000_000_000],
            ["1,234", 1234],
            ["1_000", 1000],
        ];
        for (const [input, expected] of cases) {
            const result = await parse([amount], input);
            expect(result).toEqual(expect.objectContaining({ ok: true }));
            if (result.ok) expect(result.args.integer("amount")).toBe(expected);
        }
    });

    it("rejects bad or out-of-range amounts with a reason", async () => {
        for (const input of ["abc", "1.5", "1.0001k", "-5", "0", "2b", "1e3"]) {
            const result = await parse([amount], input);
            expect(result.ok).toBe(false);
        }
        const tooBig = await parse([amount], "2b");
        expect(tooBig).toEqual({
            ok: false,
            error: "`amount` must be between `1` and `1,000,000,000`.",
        });
    });

    it("parses decimals, commas and a trailing percent sign", async () => {
        const rate: ArgSpec = {
            name: "percent",
            kind: "number",
            description: "x",
            min: 0,
            max: 50,
        };
        for (const [input, expected] of [
            ["2.5", 2.5],
            ["2,5", 2.5],
            ["12%", 12],
            ["0", 0],
        ] as const) {
            const result = await parse([rate], input);
            expect(result.ok).toBe(true);
            if (result.ok) expect(result.args.number("percent")).toBe(expected);
        }
        expect((await parse([rate], "51")).ok).toBe(false);
        expect((await parse([rate], "x")).ok).toBe(false);
    });

    it("matches a choice case-insensitively and returns the canonical value", async () => {
        const spec: ArgSpec = {
            name: "side",
            kind: "choice",
            description: "x",
            choices: ["heads", "tails"],
        };
        const result = await parse([spec], "HEADS");
        expect(result.ok && result.args.string("side")).toBe("heads");
        expect((await parse([spec], "edge")).ok).toBe(false);
    });

    it("lets optional arguments be left out, but not required ones", async () => {
        const specs: ArgSpec[] = [
            { name: "side", kind: "word", description: "x" },
            { ...amount, optional: true },
        ];
        const some = await parse(specs, "heads");
        expect(some.ok && some.args.integerOpt("amount")).toBeNull();
        expect(await parse(specs, "")).toEqual({
            ok: false,
            error: "Missing `side`.",
        });
    });

    it("joins a trailing text argument", async () => {
        const result = await parse(
            [{ name: "note", kind: "text", description: "x" }],
            "hello   big world",
        );
        expect(result.ok && result.args.string("note")).toBe("hello big world");
    });

    it("refuses extra input instead of ignoring it", async () => {
        const result = await parse([amount], "1 000");
        expect(result.ok).toBe(false);
    });

    it("says when a user can't be found or is not a user", async () => {
        const spec: ArgSpec = { name: "user", kind: "user", description: "x" };
        expect(await parse([spec], "999999999999999999")).toEqual({
            ok: false,
            error: "I couldn't find that user.",
        });
        expect((await parse([spec], "bob")).ok).toBe(false);
        expect((await parse([spec], "<@&222222222222222222>")).ok).toBe(false);
    });

    it("throws if a command reads an argument it never declared", async () => {
        const result = await parse([], "");
        if (!result.ok) throw new Error("unreachable");
        expect(() => result.args.integer("nope")).toThrow();
        expect(result.args.integerOpt("nope")).toBeNull();
    });
});

describe("usage text", () => {
    it("shows required, optional, choice and text arguments", () => {
        expect(
            formatArgs([
                { name: "user", kind: "user", description: "x" },
                { ...amount, optional: true },
                {
                    name: "side",
                    kind: "choice",
                    description: "x",
                    choices: ["heads", "tails"],
                },
                { name: "note", kind: "text", description: "x" },
            ]),
        ).toBe("<user> [amount] <heads|tails> <note…>");
    });

    it("describes plain commands, groups and subcommands", () => {
        const noop = async () => undefined;
        const transfer: PrefixCommand = {
            name: "transfer",
            description: "x",
            args: [{ name: "user", kind: "user", description: "x" }, amount],
            execute: noop,
        };
        const crypto: PrefixCommand = {
            name: "crypto",
            description: "x",
            subcommands: [
                { name: "market", description: "x", execute: noop },
                {
                    name: "buy",
                    description: "x",
                    args: [{ name: "coin", kind: "word", description: "x" }],
                    execute: noop,
                },
            ],
        };
        expect(usageOf(transfer)).toBe("transfer <user> <amount>");
        expect(usageOf(crypto)).toBe("crypto <market|buy>");
        expect(usageOf(crypto, crypto.subcommands![1])).toBe(
            "crypto buy <coin>",
        );
        expect(usageOf(crypto, crypto.subcommands![0])).toBe("crypto market");
    });
});
