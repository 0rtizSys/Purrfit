import { cryptoCommand } from "../commands/economy/public/crypto";
import { usageOf } from "../framework/args";
import { fakeCtx } from "./helpers/fake_context";

jest.mock("../services/database/repository/crypto/market", () => ({
    CHART_RANGES: {
        "1h": "1 hour",
        "24h": "24 hours",
        "7d": "7 days",
        "30d": "30 days",
    },
    QUANTITY_PATTERN: /^\d{1,22}(\.\d{1,8})?$/,
    normalizeSymbol: (s: string) => s.trim().toUpperCase(),
    listMarket: jest.fn(),
    getPriceHistory: jest.fn(),
    buyCrypto: jest.fn(),
    sellCrypto: jest.fn(),
    getPortfolio: jest.fn(),
}));
jest.mock("../services/database/repository/servers/get_eco_symbol", () => ({
    getEcoSymbol: jest.fn().mockResolvedValue("$"),
}));
jest.mock("../services/charts/price_chart", () => ({
    formatPrice: (n: number) => n.toFixed(2),
    renderPriceChart: jest.fn(() => Buffer.from("png")),
}));

import {
    buyCrypto,
    getPortfolio,
    getPriceHistory,
    listMarket,
    sellCrypto,
} from "../services/database/repository/crypto/market";

const sub = (name: string) =>
    cryptoCommand.subcommands!.find((s) => s.name === name)!;

beforeEach(() => jest.clearAllMocks());

describe("crypto structure", () => {
    it("names, aliases and usage lines", () => {
        expect(cryptoCommand.aliases).toEqual(["c"]);
        expect(
            cryptoCommand.subcommands!.map((s) => [s.name, s.aliases]),
        ).toEqual([
            ["market", ["m"]],
            ["chart", ["ch"]],
            ["buy", ["b"]],
            ["sell", ["s"]],
            ["portfolio", ["pf", "port"]],
        ]);
        expect(usageOf(cryptoCommand, sub("buy"))).toBe(
            "crypto buy <PURR|MEOW|WSK|NIP|TUNA> <amount>",
        );
        expect(usageOf(cryptoCommand, sub("chart"))).toContain(
            "[1h|24h|7d|30d]",
        );
    });
});

describe("crypto buy", () => {
    const run = async (amount: number, prefix = "$>") => {
        const c = fakeCtx({ args: { coin: "purr", amount }, prefix });
        await sub("buy").execute(c.ctx);
        return c;
    };

    it("buys and reports the purchase", async () => {
        jest.mocked(buyCrypto).mockResolvedValue({
            ok: true,
            quantity: "2.50000000",
            price: 200,
            newWallet: 500,
        });
        const { replies } = await run(500);
        expect(buyCrypto).toHaveBeenCalledWith(
            "user-1",
            "guild-1",
            "PURR",
            500,
        );
        expect(replies()[0].embed.title).toContain("Purchase complete");
        expect(replies()[0].embed.description).toContain("2.5 PURR");
    });

    it("insufficient funds", async () => {
        jest.mocked(buyCrypto).mockResolvedValue({
            ok: false,
            reason: "insufficient_funds",
            currentBalance: 10,
        });
        const { replies } = await run(500);
        expect(replies()[0].embed.title).toContain("Not enough money");
        expect(replies()[0].temporary).toBe(true);
    });

    it("unknown coin uses the server prefix in the hint", async () => {
        jest.mocked(buyCrypto).mockResolvedValue({
            ok: false,
            reason: "unknown_coin",
        });
        const { replies } = await run(500, "p!");
        expect(replies()[0].embed.title).toContain("Unknown coin");
        expect(replies()[0].embed.description).toContain("`p!crypto market`");
    });

    it("too small", async () => {
        jest.mocked(buyCrypto).mockResolvedValue({
            ok: false,
            reason: "too_small",
        });
        const { replies } = await run(1);
        expect(replies()[0].embed.title).toContain("too small");
    });

    it("an invalid amount never reaches the repository", async () => {
        const { replies } = await run(0);
        expect(buyCrypto).not.toHaveBeenCalled();
        expect(replies()[0].temporary).toBe(true);
    });
});

describe("crypto sell", () => {
    const run = async (quantity: string | undefined, prefix = "$>") => {
        const args: Record<string, unknown> = { coin: "MEOW" };
        if (quantity !== undefined) args.quantity = quantity;
        const c = fakeCtx({ args, prefix });
        await sub("sell").execute(c.ctx);
        return c;
    };

    it("sells everything when the quantity is omitted", async () => {
        jest.mocked(sellCrypto).mockResolvedValue({
            ok: true,
            quantity: "1.00000000",
            price: 10,
            proceeds: 100,
            tax: 10,
            newWallet: 190,
        });
        const { replies } = await run(undefined);
        expect(sellCrypto).toHaveBeenCalledWith(
            "user-1",
            "guild-1",
            "MEOW",
            null,
        );
        const fields = replies()[0].embed.fields!.map((f) => f.name);
        expect(replies()[0].embed.title).toContain("Sale complete");
        expect(fields.some((n) => n.includes("Tax"))).toBe(true);
    });

    it("passes an explicit quantity", async () => {
        jest.mocked(sellCrypto).mockResolvedValue({
            ok: true,
            quantity: "0.5",
            price: 10,
            proceeds: 5,
            tax: 0,
            newWallet: 5,
        });
        await run("0.5");
        expect(sellCrypto).toHaveBeenCalledWith(
            "user-1",
            "guild-1",
            "MEOW",
            "0.5",
        );
    });

    it("rejects a malformed quantity without touching the repository", async () => {
        const { replies } = await run("1e5");
        expect(sellCrypto).not.toHaveBeenCalled();
        expect(replies()[0].embed.title).toContain("Invalid quantity");
    });

    it("no holdings hint uses the prefix", async () => {
        jest.mocked(sellCrypto).mockResolvedValue({
            ok: false,
            reason: "no_holdings",
        });
        const { replies } = await run("1", "p!");
        expect(replies()[0].embed.description).toContain(
            "`p!crypto portfolio`",
        );
    });

    it("insufficient holdings", async () => {
        jest.mocked(sellCrypto).mockResolvedValue({
            ok: false,
            reason: "insufficient_holdings",
            held: "0.50000000",
        });
        const { replies } = await run("1");
        expect(replies()[0].embed.description).toContain("0.5 MEOW");
    });
});

describe("crypto market, chart and portfolio", () => {
    it("market lists the coins with prefixed hints", async () => {
        jest.mocked(listMarket).mockResolvedValue([
            { symbol: "PURR", name: "Purrcoin", price: 10, price24hAgo: 8 },
        ]);
        const { ctx, replies } = fakeCtx({ prefix: "p!" });
        await sub("market").execute(ctx);
        expect(replies()[0].embed.fields).toHaveLength(1);
        expect(replies()[0].embed.description).toContain("`p!crypto chart");
    });

    it("chart attaches a file", async () => {
        jest.mocked(getPriceHistory).mockResolvedValue({
            name: "Purrcoin",
            points: [
                { at: new Date(), price: 10 },
                { at: new Date(), price: 12 },
            ],
        });
        const { ctx, replies } = fakeCtx({ args: { coin: "PURR" } });
        await sub("chart").execute(ctx);
        expect(getPriceHistory).toHaveBeenCalledWith("PURR", "24h");
        expect(replies()[0].files).toHaveLength(1);
    });

    it("chart for an unknown coin attaches nothing", async () => {
        jest.mocked(getPriceHistory).mockResolvedValue(null);
        const { ctx, replies } = fakeCtx({
            args: { coin: "PURR", range: "7d" },
        });
        await sub("chart").execute(ctx);
        expect(getPriceHistory).toHaveBeenCalledWith("PURR", "7d");
        expect(replies()[0].embed.title).toContain("Unknown coin");
        expect(replies()[0].files).toHaveLength(0);
    });

    it("portfolio empty and filled", async () => {
        jest.mocked(getPortfolio).mockResolvedValueOnce([]);
        const a = fakeCtx({ prefix: "p!" });
        await sub("portfolio").execute(a.ctx);
        expect(a.replies()[0].embed.description).toContain("own any coins");
        expect(a.replies()[0].embed.description).toContain("`p!crypto buy");

        jest.mocked(getPortfolio).mockResolvedValueOnce([
            {
                symbol: "PURR",
                name: "Purrcoin",
                quantity: "2.00000000",
                price: 10,
                value: 20,
                costBasis: 10,
            },
        ]);
        const b = fakeCtx();
        await sub("portfolio").execute(b.ctx);
        expect(b.replies()[0].embed.fields).toHaveLength(1);
    });
});
