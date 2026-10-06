import { transferCommand } from "../commands/economy/public/transfer";
import { transferSafe } from "../services/database/repository/clients/transaction";
import { getEcoSymbol } from "../services/database/repository/servers/get_eco_symbol";
import { usageOf } from "../framework/args";
import { fakeCtx, fakeUser } from "./helpers/fake_context";

jest.mock("../services/database/repository/clients/transaction", () => ({
    transferSafe: jest.fn(),
}));
jest.mock("../services/database/repository/servers/get_eco_symbol", () => ({
    getEcoSymbol: jest.fn(),
}));

const transferMock = jest.mocked(transferSafe);

beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getEcoSymbol).mockResolvedValue("$");
});

describe("transferCommand", () => {
    it("declares its contract", () => {
        expect(usageOf(transferCommand)).toBe("transfer <user> <amount>");
        expect(transferCommand.aliases).toEqual(["pay", "send"]);
    });

    it("sends money and shows a public receipt without tax", async () => {
        transferMock.mockResolvedValue({
            ok: true,
            tax: 0,
            received: 300,
        } as never);
        const { ctx, replies } = fakeCtx({
            args: { user: fakeUser("user-2"), amount: 300 },
        });

        await transferCommand.execute!(ctx);

        expect(transferMock).toHaveBeenCalledWith(
            "user-1",
            "user-2",
            "guild-1",
            300,
        );
        const [reply] = replies();
        expect(reply.embed.title).toContain("Transfer complete");
        expect(reply.embed.fields?.map((f) => f.name)).toEqual(["From", "To"]);
        expect(reply.embed.fields?.[1].value).toBe("<@user-2>");
        expect(reply.temporary).toBe(false);
    });

    it("shows tax and received amounts when there is tax", async () => {
        transferMock.mockResolvedValue({
            ok: true,
            tax: 30,
            received: 270,
        } as never);
        const { ctx, replies } = fakeCtx({
            args: { user: fakeUser("user-2"), amount: 300 },
        });

        await transferCommand.execute!(ctx);

        const names = replies()[0].embed.fields!.map((f) => f.name);
        expect(names).toHaveLength(4);
        expect(names).toContain("Received");
    });

    it("shows insufficient funds with the bank hint using the prefix", async () => {
        transferMock.mockResolvedValue({
            ok: false,
            reason: "insufficient_funds",
            currentBalance: 10,
        } as never);
        const { ctx, replies } = fakeCtx({
            args: { user: fakeUser("user-2"), amount: 300 },
            prefix: "p!",
        });

        await transferCommand.execute!(ctx);

        const [reply] = replies();
        expect(reply.embed.title).toContain("Not enough money");
        expect(reply.embed.description).toContain("`p!deposit`");
        expect(reply.temporary).toBe(true);
    });

    it("rejects a self transfer with prefix hints and writes nothing", async () => {
        const { ctx, replies } = fakeCtx({
            args: { user: fakeUser("user-1"), amount: 300 },
            prefix: "p!",
        });

        await transferCommand.execute!(ctx);

        expect(transferMock).not.toHaveBeenCalled();
        const [reply] = replies();
        expect(reply.embed.title).toContain("pay yourself");
        expect(reply.embed.description).toContain("`p!deposit`");
        expect(reply.temporary).toBe(true);
    });

    it("rejects a bot target and writes nothing", async () => {
        const { ctx, replies } = fakeCtx({
            args: { user: fakeUser("bot-1", true), amount: 300 },
        });

        await transferCommand.execute!(ctx);

        expect(transferMock).not.toHaveBeenCalled();
        expect(replies()[0].embed.title).toContain("Bots");
        expect(replies()[0].temporary).toBe(true);
    });

    it("rejects an invalid amount and writes nothing", async () => {
        const { ctx, replies } = fakeCtx({
            args: { user: fakeUser("user-2"), amount: 0 },
        });

        await transferCommand.execute!(ctx);

        expect(transferMock).not.toHaveBeenCalled();
        expect(replies()[0].temporary).toBe(true);
    });
});
