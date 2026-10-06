import { depositCommand } from "../commands/economy/public/deposit";
import { withdrawCommand } from "../commands/economy/public/withdraw";
import { getEcoSymbol } from "../services/database/repository/servers/get_eco_symbol";
import { transferInternalSafe } from "../services/database/repository/clients/withdraw-transfer";
import { usageOf } from "../framework/args";
import { fakeCtx } from "./helpers/fake_context";

jest.mock("../services/database/repository/servers/get_eco_symbol", () => ({
    getEcoSymbol: jest.fn(),
}));

jest.mock("../services/database/repository/clients/withdraw-transfer", () => ({
    transferInternalSafe: jest.fn(),
}));

const getEcoSymbolMock = jest.mocked(getEcoSymbol);
const transferMock = jest.mocked(transferInternalSafe);

beforeEach(() => {
    jest.clearAllMocks();
    getEcoSymbolMock.mockResolvedValue("$");
    transferMock.mockResolvedValue({ ok: true } as never);
});

describe("depositCommand", () => {
    it("declares its contract", () => {
        expect(usageOf(depositCommand)).toBe("deposit <amount>");
        expect(depositCommand.aliases).toEqual(["dep", "d"]);
    });

    it("moves money from wallet to bank and replies publicly", async () => {
        const { ctx, replies } = fakeCtx({ args: { amount: 250 } });

        await depositCommand.execute!(ctx);

        expect(ctx.defer).toHaveBeenCalled();
        expect(transferMock).toHaveBeenCalledWith(
            "user-1",
            "guild-1",
            250,
            "wallet",
            "bank",
        );
        const [reply] = replies();
        expect(reply.embed.title).toContain("Deposit complete");
        expect(reply.embed.description).toContain("250");
        expect(reply.temporary).toBe(false);
    });

    it("shows insufficient funds (temporary) with the server prefix", async () => {
        transferMock.mockResolvedValue({
            ok: false,
            reason: "insufficient_funds",
            currentBalance: 100,
        } as never);
        const { ctx, replies } = fakeCtx({
            args: { amount: 250 },
            prefix: "p!",
        });

        await depositCommand.execute!(ctx);

        const all = replies();
        expect(all).toHaveLength(1);
        expect(all[0].embed.title).toContain("Not enough money");
        expect(all[0].embed.description).toContain("deposit");
        expect(all[0].embed.description).toContain("150");
        expect(all[0].temporary).toBe(true);
    });

    it.each([0, -5, 1_000_000_001, 1.5])(
        "writes nothing when the amount %s is invalid",
        async (amount) => {
            const { ctx, replies } = fakeCtx({ args: { amount } });

            await depositCommand.execute!(ctx);

            expect(transferMock).not.toHaveBeenCalled();
            expect(replies()).toHaveLength(1);
            expect(replies()[0].temporary).toBe(true);
        },
    );
});

describe("withdrawCommand", () => {
    it("declares its contract", () => {
        expect(usageOf(withdrawCommand)).toBe("withdraw <amount>");
        expect(withdrawCommand.aliases).toEqual(["with", "wd"]);
    });

    it("moves money from bank to wallet and replies publicly", async () => {
        const { ctx, replies } = fakeCtx({ args: { amount: 400 } });

        await withdrawCommand.execute!(ctx);

        expect(transferMock).toHaveBeenCalledWith(
            "user-1",
            "guild-1",
            400,
            "bank",
            "wallet",
        );
        const [reply] = replies();
        expect(reply.embed.title).toContain("Withdrawal complete");
        expect(reply.temporary).toBe(false);
    });

    it("shows insufficient funds instead of success", async () => {
        transferMock.mockResolvedValue({
            ok: false,
            reason: "insufficient_funds",
            currentBalance: 0,
        } as never);
        const { ctx, replies } = fakeCtx({ args: { amount: 400 } });

        await withdrawCommand.execute!(ctx);

        expect(replies()).toHaveLength(1);
        expect(replies()[0].embed.title).toContain("Not enough money");
        expect(replies()[0].temporary).toBe(true);
    });

    it("writes nothing when the amount is invalid", async () => {
        const { ctx, replies } = fakeCtx({ args: { amount: 0 } });

        await withdrawCommand.execute!(ctx);

        expect(transferMock).not.toHaveBeenCalled();
        expect(replies()[0].temporary).toBe(true);
    });
});
