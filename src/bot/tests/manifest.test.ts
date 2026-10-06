import { buildManifest } from "../framework/manifest";
import type { CommandCategory } from "../framework/types";

const noop = async () => undefined;

const categories: CommandCategory[] = [
    {
        id: "economy",
        title: "Economy",
        commands: [
            {
                name: "transfer",
                aliases: ["pay"],
                description: "Send money",
                args: [
                    { name: "user", kind: "user", description: "x" },
                    { name: "amount", kind: "amount", description: "x" },
                ],
                execute: noop,
            },
            {
                name: "crypto",
                description: "Trade",
                subcommands: [
                    {
                        name: "buy",
                        aliases: ["b"],
                        description: "Buy",
                        args: [
                            { name: "coin", kind: "word", description: "x" },
                        ],
                        execute: noop,
                    },
                ],
            },
        ],
    },
    {
        id: "dev",
        title: "Developer",
        commands: [
            {
                name: "sync",
                permission: "owner",
                description: "x",
                execute: noop,
            },
        ],
    },
];

describe("buildManifest", () => {
    const manifest = buildManifest(
        categories,
        [{ name: "help", description: "Help" }],
        new Date("2026-10-06T00:00:00Z"),
    );

    it("describes commands without the prefix", () => {
        const [economy] = manifest.categories;
        expect(economy.commands[0]).toEqual({
            name: "transfer",
            aliases: ["pay"],
            description: "Send money",
            usage: "transfer <user> <amount>",
            permission: "everyone",
            subcommands: [],
        });
        expect(economy.commands[1].usage).toBe("crypto <buy>");
        expect(economy.commands[1].subcommands[0].usage).toBe(
            "crypto buy <coin>",
        );
    });

    it("leaves out owner commands and the categories that only had them", () => {
        const names = manifest.categories.flatMap((c) =>
            c.commands.map((cmd) => cmd.name),
        );
        expect(names).not.toContain("sync");
        expect(manifest.categories.map((c) => c.id)).toEqual(["economy"]);
    });

    it("lists the slash commands and the default prefix", () => {
        expect(manifest.slash).toEqual([{ name: "help", description: "Help" }]);
        expect(manifest.defaultPrefix).toBe("$>");
        expect(manifest.version).toBe(1);
        expect(manifest.generatedAt).toBe("2026-10-06T00:00:00.000Z");
    });
});
