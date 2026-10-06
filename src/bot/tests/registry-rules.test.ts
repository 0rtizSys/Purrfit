import { buildRegistry, findSubcommand } from "../framework/registry";
import type { PrefixCommand } from "../framework/types";

const noop = async () => undefined;
const cmd = (
    over: Partial<PrefixCommand> & { name: string },
): PrefixCommand => ({
    description: "x",
    execute: noop,
    ...over,
});

describe("buildRegistry", () => {
    it("finds commands by name and alias, ignoring case", () => {
        const registry = buildRegistry([cmd({ name: "work", aliases: ["w"] })]);
        expect(registry.find("work")?.name).toBe("work");
        expect(registry.find("W")?.name).toBe("work");
        expect(registry.find("nope")).toBeUndefined();
    });

    it("refuses two commands that answer to the same word", () => {
        expect(() =>
            buildRegistry([
                cmd({ name: "work", aliases: ["w"] }),
                cmd({ name: "wallet", aliases: ["w"] }),
            ]),
        ).toThrow(/"w" is used by both/);
        expect(() =>
            buildRegistry([
                cmd({ name: "bal" }),
                cmd({ name: "x", aliases: ["bal"] }),
            ]),
        ).toThrow();
    });

    it("refuses malformed definitions", () => {
        expect(() => buildRegistry([cmd({ name: "Work" })])).toThrow(
            /Invalid command word/,
        );
        expect(() => buildRegistry([cmd({ name: "two words" })])).toThrow();
        expect(() =>
            buildRegistry([cmd({ name: "x", execute: undefined })]),
        ).toThrow(/neither/);
        expect(() =>
            buildRegistry([
                cmd({
                    name: "x",
                    subcommands: [
                        { name: "a", description: "x", execute: noop },
                    ],
                }),
            ]),
        ).toThrow(/both/);
        expect(() =>
            buildRegistry([
                cmd({
                    name: "x",
                    execute: undefined,
                    args: [{ name: "a", kind: "word", description: "x" }],
                    subcommands: [
                        { name: "a", description: "x", execute: noop },
                    ],
                }),
            ]),
        ).toThrow(/belong to each subcommand/);
    });

    it("refuses repeated subcommand words", () => {
        expect(() =>
            buildRegistry([
                cmd({
                    name: "crypto",
                    execute: undefined,
                    subcommands: [
                        {
                            name: "buy",
                            aliases: ["b"],
                            description: "x",
                            execute: noop,
                        },
                        {
                            name: "bank",
                            aliases: ["b"],
                            description: "x",
                            execute: noop,
                        },
                    ],
                }),
            ]),
        ).toThrow(/repeated subcommand/);
    });

    it("finds subcommands by name or alias", () => {
        const crypto = cmd({
            name: "crypto",
            execute: undefined,
            subcommands: [
                {
                    name: "buy",
                    aliases: ["b"],
                    description: "x",
                    execute: noop,
                },
            ],
        });
        expect(findSubcommand(crypto, "BUY")?.name).toBe("buy");
        expect(findSubcommand(crypto, "b")?.name).toBe("buy");
        expect(findSubcommand(crypto, "sell")).toBeUndefined();
        expect(findSubcommand(crypto, undefined)).toBeUndefined();
    });
});
