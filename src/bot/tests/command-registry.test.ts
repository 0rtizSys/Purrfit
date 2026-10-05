import { cmds, devCmds, publicCmds } from "../syncer";

jest.mock("../services/database/db", () => ({
    pool: { query: jest.fn(), connect: jest.fn() },
}));

describe("command registry", () => {
    it("has unique command names", () => {
        const names = cmds.map((c) => c.data.name);
        expect(new Set(names).size).toBe(names.length);
    });

    it("never publishes developer commands globally", () => {
        const publicNames = publicCmds.map((c) => c.data.name);
        for (const dev of devCmds)
            expect(publicNames).not.toContain(dev.data.name);
        expect(devCmds.map((c) => c.data.name)).toContain("sync_slash_guild");
    });

    it("builds valid Discord payloads", () => {
        for (const cmd of cmds) expect(() => cmd.data.toJSON()).not.toThrow();
    });
});
