import { readFileSync } from "fs";
import { join } from "path";
import { addBalanceCommand } from "../commands/economy/moderators/add_balance";
import { setCdTimeAdmin } from "../commands/economy/admin/set_cd_time.admin";
import { setEconomySymbolAdmin } from "../commands/economy/admin/set_eco_symbol.admin";
import { setTaxRateAdmin } from "../commands/economy/admin/set_tax_rate.admin";
import { setInterestRateAdmin } from "../commands/economy/admin/set_interest_rate.admin";
import { usageOf } from "../framework/args";
import { fakeCtx, fakeUser } from "./helpers/fake_context";

jest.mock("../services/database/repository/clients/manager", () => ({
    addBalance: jest.fn(),
}));
jest.mock("../services/database/repository/servers/get_eco_symbol", () => ({
    getEcoSymbol: jest.fn().mockResolvedValue("$"),
}));
jest.mock("../services/database/repository/servers/set_eco_symbol", () => ({
    setEcoSymbol: jest.fn().mockResolvedValue(true),
}));
jest.mock("../services/database/repository/servers/get_cd_time", () => ({
    getCdTime: jest.fn().mockResolvedValue(1800),
}));
jest.mock("../services/database/repository/servers/set_cd_time", () => ({
    MAX_COOLDOWN_SECONDS: 2_592_000,
    setCdTime: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../services/database/repository/servers/economy_settings", () => ({
    getEconomySettings: jest
        .fn()
        .mockResolvedValue({ taxBps: 100, interestBps: 10 }),
    setTaxRate: jest.fn().mockResolvedValue(undefined),
    setInterestRate: jest.fn().mockResolvedValue(undefined),
}));

import { addBalance } from "../services/database/repository/clients/manager";
import { setEcoSymbol } from "../services/database/repository/servers/set_eco_symbol";
import { setCdTime } from "../services/database/repository/servers/set_cd_time";
import {
    setInterestRate,
    setTaxRate,
} from "../services/database/repository/servers/economy_settings";

beforeEach(() => jest.clearAllMocks());

describe("admin commands: contract", () => {
    const all = [
        [
            addBalanceCommand,
            "add_balance",
            "addbal",
            "../commands/economy/moderators/add_balance.ts",
        ],
        [
            setCdTimeAdmin,
            "set_cooldown_time",
            "setcd",
            "../commands/economy/admin/set_cd_time.admin.ts",
        ],
        [
            setEconomySymbolAdmin,
            "set_economy_symbol",
            "setsymbol",
            "../commands/economy/admin/set_eco_symbol.admin.ts",
        ],
        [
            setTaxRateAdmin,
            "set_tax_rate",
            "settax",
            "../commands/economy/admin/set_tax_rate.admin.ts",
        ],
        [
            setInterestRateAdmin,
            "set_interest_rate",
            "setinterest",
            "../commands/economy/admin/set_interest_rate.admin.ts",
        ],
    ] as const;

    it.each(all)(
        "%# is admin-only with no own permission check",
        (command, name, alias, file) => {
            expect(command.name).toBe(name);
            expect(command.aliases).toEqual([alias]);
            expect(command.permission).toBe("admin");
            const source = readFileSync(join(__dirname, file), "utf8");
            expect(source).not.toMatch(
                /memberPermissions|notEnoughPermsEmbed|isAdmin|PermissionFlagsBits|setDefaultMemberPermissions/,
            );
        },
    );

    it("usage lines", () => {
        expect(usageOf(addBalanceCommand)).toBe(
            "add_balance <user> <wallet|bank> <amount>",
        );
        expect(usageOf(setCdTimeAdmin)).toBe("set_cooldown_time <seconds>");
        expect(usageOf(setEconomySymbolAdmin)).toBe(
            "set_economy_symbol <symbol>",
        );
        expect(usageOf(setTaxRateAdmin)).toBe("set_tax_rate <percent>");
        expect(usageOf(setInterestRateAdmin)).toBe(
            "set_interest_rate <percent>",
        );
    });
});

describe("add_balance", () => {
    const run = async (args: Record<string, unknown>) => {
        const c = fakeCtx({ args });
        await addBalanceCommand.execute!(c.ctx);
        return c;
    };
    it("adds to the target", async () => {
        jest.mocked(addBalance).mockResolvedValue(1500);
        const { replies } = await run({
            user: fakeUser("u2"),
            method: "bank",
            amount: 500,
        });
        expect(addBalance).toHaveBeenCalledWith("u2", "guild-1", "bank", 500);
        expect(replies()[0].embed.title).toContain("Balance added");
        expect(replies()[0].temporary).toBe(false);
    });
    it("rejects bots", async () => {
        const { replies } = await run({
            user: fakeUser("b", true),
            method: "wallet",
            amount: 5,
        });
        expect(addBalance).not.toHaveBeenCalled();
        expect(replies()[0].embed.title).toContain("Bots");
    });
    it("rejects an out-of-range amount and a bad method", async () => {
        const a = await run({
            user: fakeUser("u2"),
            method: "wallet",
            amount: 2_000_000_000,
        });
        expect(a.replies()[0].embed.title).toContain("Invalid amount");
        const b = await run({
            user: fakeUser("u2"),
            method: "cash",
            amount: 5,
        });
        expect(b.replies()[0].embed.title).toContain("Invalid method");
        expect(addBalance).not.toHaveBeenCalled();
    });
});

describe("set_cooldown_time", () => {
    it("updates", async () => {
        const { ctx, replies } = fakeCtx({ args: { seconds: 3600 } });
        await setCdTimeAdmin.execute!(ctx);
        expect(setCdTime).toHaveBeenCalledWith("guild-1", 3600);
        expect(replies()[0].embed.title).toContain("cooldown updated");
    });
    it("rejects out-of-range values", async () => {
        for (const seconds of [0, 3_000_000]) {
            const { ctx, replies } = fakeCtx({ args: { seconds } });
            await setCdTimeAdmin.execute!(ctx);
            expect(replies()[0].embed.title).toContain("Invalid cooldown");
        }
        expect(setCdTime).not.toHaveBeenCalled();
    });
});

describe("set_economy_symbol", () => {
    it("accepts a symbol and an emoji", async () => {
        for (const symbol of ["€", "🪙"]) {
            const { ctx, replies } = fakeCtx({ args: { symbol } });
            await setEconomySymbolAdmin.execute!(ctx);
            expect(setEcoSymbol).toHaveBeenLastCalledWith("guild-1", symbol);
            expect(replies()[0].embed.title).toContain("symbol updated");
        }
    });
    it.each(["abc", "`", "@e", "<a"])("rejects %s", async (symbol) => {
        const { ctx, replies } = fakeCtx({ args: { symbol } });
        await setEconomySymbolAdmin.execute!(ctx);
        expect(setEcoSymbol).not.toHaveBeenCalled();
        expect(replies()[0].embed.title).toContain("Invalid symbol");
    });
});

describe("tax and interest rates", () => {
    it("set_tax_rate saves basis points", async () => {
        const { ctx, replies } = fakeCtx({ args: { percent: 2.5 } });
        await setTaxRateAdmin.execute!(ctx);
        expect(setTaxRate).toHaveBeenCalledWith("guild-1", 250);
        expect(replies()[0].embed.description).toContain("1%");
        expect(replies()[0].embed.description).toContain("2.5%");
    });
    it("set_tax_rate rejects out of range", async () => {
        const { ctx, replies } = fakeCtx({ args: { percent: 50.5 } });
        await setTaxRateAdmin.execute!(ctx);
        expect(setTaxRate).not.toHaveBeenCalled();
        expect(replies()[0].embed.title).toContain("Invalid rate");
    });
    it("set_interest_rate saves basis points", async () => {
        const { ctx } = fakeCtx({ args: { percent: 5 } });
        await setInterestRateAdmin.execute!(ctx);
        expect(setInterestRate).toHaveBeenCalledWith("guild-1", 500);
    });
    it("set_interest_rate rejects out of range", async () => {
        for (const percent of [5.01, -1, NaN]) {
            const { ctx, replies } = fakeCtx({ args: { percent } });
            await setInterestRateAdmin.execute!(ctx);
            expect(replies()[0].embed.title).toContain("Invalid rate");
        }
        expect(setInterestRate).not.toHaveBeenCalled();
    });
});
