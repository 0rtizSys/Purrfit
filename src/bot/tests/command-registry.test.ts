import { commandCategories, prefixCmds, registry, slashCmds } from "../syncer";
import { DEFAULT_RATE_LIMITS } from "../services/rate_limit";

jest.mock("../services/database/db", () => ({
    pool: { query: jest.fn(), connect: jest.fn() },
}));

//? The names the docs, the dashboard and the rate limits rely on. Renaming a
//? command is a breaking change for every user, so it must be deliberate.
const EXPECTED = [
    "work",
    "wallet_balance",
    "bank_balance",
    "deposit",
    "withdraw",
    "transfer",
    "leaderboard",
    "economy_info",
    "crypto",
    "coinflip",
    "add_balance",
    "set_cooldown_time",
    "set_economy_symbol",
    "set_tax_rate",
    "set_interest_rate",
    "prefix",
    "ping",
    "delete_my_data",
    "sync",
];

describe("command registry", () => {
    it("registers exactly the commands v3 promises", () => {
        expect(prefixCmds.map((c) => c.name).sort()).toEqual(
            [...EXPECTED].sort(),
        );
    });

    it("keeps only /help, /dashboard and /support as slash commands", () => {
        expect(slashCmds.map((c) => c.data.name).sort()).toEqual([
            "dashboard",
            "help",
            "support",
        ]);
    });

    it("builds valid Discord payloads for the slash commands", () => {
        for (const cmd of slashCmds)
            expect(() => cmd.data.toJSON()).not.toThrow();
    });

    it("has no shared names or aliases (the registry throws on import otherwise)", () => {
        const words = prefixCmds.flatMap((c) => [c.name, ...(c.aliases ?? [])]);
        expect(new Set(words).size).toBe(words.length);
        expect(registry.commands).toHaveLength(prefixCmds.length);
    });

    it("every alias resolves to its command", () => {
        for (const cmd of prefixCmds)
            for (const alias of cmd.aliases ?? [])
                expect(registry.find(alias)).toBe(cmd);
    });

    it("keeps owner commands out of the user-facing categories", () => {
        for (const category of commandCategories)
            for (const cmd of category.commands)
                expect(cmd.permission === "owner").toBe(category.id === "dev");
    });

    it("gives admin permission to the commands that change the server", () => {
        const admin = prefixCmds
            .filter((c) => c.permission === "admin")
            .map((c) => c.name)
            .sort();
        expect(admin).toEqual([
            "add_balance",
            "set_cooldown_time",
            "set_economy_symbol",
            "set_interest_rate",
            "set_tax_rate",
        ]);
    });

    it("has a description for every command and subcommand", () => {
        for (const cmd of prefixCmds) {
            expect(cmd.description.length).toBeGreaterThan(0);
            for (const sub of cmd.subcommands ?? [])
                expect(sub.description.length).toBeGreaterThan(0);
        }
    });

    it("rate-limits only commands that exist", () => {
        const names = new Set([
            ...prefixCmds.map((c) => c.name),
            ...slashCmds.map((c) => c.data.name),
        ]);
        for (const name of Object.keys(DEFAULT_RATE_LIMITS.commandCooldownsMs))
            expect(names).toContain(name);
    });
});
