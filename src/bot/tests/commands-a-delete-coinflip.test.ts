import { deleteMyDataCommand } from "../commands/utils/delete_my_data";
import { coinFlipCommand } from "../commands/games/coin_flip";
import { deleteUserData } from "../services/database/repository/clients/delete_data";
import { applyWalletWager } from "../services/database/repository/clients/wager";
import { getEcoSymbol } from "../services/database/repository/servers/get_eco_symbol";
import { usageOf } from "../framework/args";
import { fakeCtx } from "./helpers/fake_context";

jest.mock("../services/database/repository/clients/delete_data", () => ({
    deleteUserData: jest.fn(),
}));
jest.mock("../services/database/repository/clients/wager", () => ({
    applyWalletWager: jest.fn(),
}));
jest.mock("../services/database/repository/servers/get_eco_symbol", () => ({
    getEcoSymbol: jest.fn(),
}));
jest.mock("../services/logger", () => ({
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

const deleteMock = jest.mocked(deleteUserData);
const wagerMock = jest.mocked(applyWalletWager);

beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getEcoSymbol).mockResolvedValue("$");
});

describe("deleteMyDataCommand", () => {
    it("declares its contract", () => {
        expect(usageOf(deleteMyDataCommand)).toBe("delete_my_data [confirm]");
        expect(deleteMyDataCommand.aliases).toEqual(["deletedata"]);
    });

    it("only warns without confirm, deleting nothing", async () => {
        const { ctx, replies } = fakeCtx({ prefix: "p!" });

        await deleteMyDataCommand.execute!(ctx);

        expect(deleteMock).not.toHaveBeenCalled();
        const [reply] = replies();
        expect(reply.embed.title).toContain("delete your data");
        expect(reply.embed.description).toContain("`p!delete_my_data confirm`");
        expect(reply.temporary).toBe(false);
    });

    it("deletes the data of the caller with confirm", async () => {
        deleteMock.mockResolvedValue({} as never);
        const { ctx, replies } = fakeCtx({ args: { confirm: "confirm" } });

        await deleteMyDataCommand.execute!(ctx);

        expect(deleteMock).toHaveBeenCalledWith("user-1");
        expect(replies()[0].embed.title).toContain("Your data was deleted");
    });
});

describe("coinFlipCommand", () => {
    it("declares its contract", () => {
        expect(usageOf(coinFlipCommand)).toBe(
            "coinflip <heads|tails> [amount]",
        );
        expect(coinFlipCommand.aliases).toEqual(["cf", "flip"]);
    });

    it("bets the default 50 when no amount is given", async () => {
        wagerMock.mockResolvedValue({
            ok: true,
            previousBalance: 500,
            newBalance: 550,
        } as never);
        const { ctx, replies } = fakeCtx({ args: { choice: "heads" } });

        await coinFlipCommand.execute!(ctx);

        expect(wagerMock).toHaveBeenCalledTimes(1);
        const [user, guild, amount, delta] = wagerMock.mock.calls[0];
        expect([user, guild, amount]).toEqual(["user-1", "guild-1", 50]);
        expect(Math.abs(delta)).toBe(50);
        const [reply] = replies();
        expect(reply.embed.title).toMatch(/You (won!|lost)/);
        expect(reply.embed.fields?.[0].name).toBe("Bet");
        expect(reply.temporary).toBe(false);
    });

    it("uses the given amount", async () => {
        wagerMock.mockResolvedValue({
            ok: true,
            previousBalance: 500,
            newBalance: 400,
        } as never);
        const { ctx } = fakeCtx({ args: { choice: "tails", amount: 100 } });

        await coinFlipCommand.execute!(ctx);

        expect(wagerMock.mock.calls[0][2]).toBe(100);
    });

    it("shows insufficient funds with the prefix hint", async () => {
        wagerMock.mockResolvedValue({
            ok: false,
            currentBalance: 10,
        } as never);
        const { ctx, replies } = fakeCtx({
            args: { choice: "heads", amount: 100 },
            prefix: "p!",
        });

        await coinFlipCommand.execute!(ctx);

        const [reply] = replies();
        expect(reply.embed.title).toContain("Not enough money");
        expect(reply.embed.description).toContain("90");
        expect(reply.temporary).toBe(true);
    });

    it("writes nothing when the amount is invalid", async () => {
        const { ctx, replies } = fakeCtx({
            args: { choice: "heads", amount: 0 },
        });

        await coinFlipCommand.execute!(ctx);

        expect(wagerMock).not.toHaveBeenCalled();
        expect(replies()[0].temporary).toBe(true);
    });
});
