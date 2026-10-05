import { ChatInputCommandInteraction, MessageFlags } from "discord.js";
import { depositCommand } from "../commands/economy/public/deposit";
import { withdrawCommand } from "../commands/economy/public/withdraw";
import { requireGuild } from "../Helpers/require_guild";
import { isInvalidAmount } from "../Helpers/validators";
import { getEcoSymbol } from "../services/database/repository/servers/get_eco_symbol";
import { transferInternalSafe } from "../services/database/repository/clients/withdraw-transfer";
import {
    InsuficientsFundsEmbed,
    sendSimpleEmbed,
} from "../Helpers/simplified_embed_builder";

jest.mock("../Helpers/require_guild", () => ({
    requireGuild: jest.fn(),
}));

jest.mock("../Helpers/validators", () => ({
    isInvalidAmount: jest.fn(),
    MIN_AMOUNT: 1,
    MAX_AMOUNT: 1_000_000_000,
}));

jest.mock("../services/database/repository/servers/get_eco_symbol", () => ({
    getEcoSymbol: jest.fn(),
}));

jest.mock("../services/database/repository/clients/withdraw-transfer", () => ({
    transferInternalSafe: jest.fn(),
}));

jest.mock("../Helpers/simplified_embed_builder", () => ({
    internalErrorEmbed: jest.fn(),
    sendSimpleEmbed: jest.fn(),
    InsuficientsFundsEmbed: jest.fn(),
}));

const requireGuildMock = jest.mocked(requireGuild);
const isInvalidAmountMock = jest.mocked(isInvalidAmount);
const getEcoSymbolMock = jest.mocked(getEcoSymbol);
const transferInternalSafeMock = jest.mocked(transferInternalSafe);
const sendSimpleEmbedMock = jest.mocked(sendSimpleEmbed);
const insufficientFundsMock = jest.mocked(InsuficientsFundsEmbed);

function createInteraction(amount = 250, visibility = false) {
    return {
        inGuild: jest.fn().mockReturnValue(true),
        guild: { id: "guild-1" },
        user: {
            id: "user-1",
            toString: () => "<@user-1>",
        },
        options: {
            getBoolean: jest.fn().mockReturnValue(visibility),
            getInteger: jest.fn().mockReturnValue(amount),
        },
        deferReply: jest.fn().mockResolvedValue(undefined),
        deferred: true,
        replied: false,
    } as unknown as ChatInputCommandInteraction & {
        deferReply: jest.Mock;
    };
}

beforeEach(() => {
    jest.clearAllMocks();
    requireGuildMock.mockResolvedValue(true);
    isInvalidAmountMock.mockResolvedValue(false);
    getEcoSymbolMock.mockResolvedValue("$");
    transferInternalSafeMock.mockResolvedValue({ ok: true });
    sendSimpleEmbedMock.mockResolvedValue(undefined);
    insufficientFundsMock.mockResolvedValue(undefined);
});

describe("depositCommand", () => {
    it("moves money from wallet to bank and sends success when transaction succeeds", async () => {
        const interaction = createInteraction(250, false);

        await depositCommand.execute(interaction);

        expect(interaction.deferReply).toHaveBeenCalledWith({
            flags: MessageFlags.Ephemeral,
        });
        expect(transferInternalSafeMock).toHaveBeenCalledWith(
            "user-1",
            "guild-1",
            250,
            "wallet",
            "bank",
        );
        expect(sendSimpleEmbedMock).toHaveBeenCalledWith(
            interaction,
            expect.objectContaining({
                title: "Deposit completed ✅ ",
            }),
        );
    });

    it("shows insufficient funds using the balance read under the row lock", async () => {
        const interaction = createInteraction(250, false);
        transferInternalSafeMock.mockResolvedValue({
            ok: false,
            reason: "insufficient_funds",
            currentBalance: 100,
        });

        await depositCommand.execute(interaction);

        expect(insufficientFundsMock).toHaveBeenCalledWith(
            interaction,
            100,
            250,
            "$",
            "deposit",
        );
        expect(sendSimpleEmbedMock).not.toHaveBeenCalled();
    });

    it("does not touch the database when the amount is invalid", async () => {
        const interaction = createInteraction(0, false);
        isInvalidAmountMock.mockResolvedValue(true);

        await depositCommand.execute(interaction);

        expect(interaction.deferReply).not.toHaveBeenCalled();
        expect(transferInternalSafeMock).not.toHaveBeenCalled();
    });
});

describe("withdrawCommand", () => {
    it("moves money from bank to wallet and sends success when transaction succeeds", async () => {
        const interaction = createInteraction(400, true);

        await withdrawCommand.execute(interaction);

        expect(interaction.deferReply).toHaveBeenCalledWith({
            flags: undefined,
        });
        expect(transferInternalSafeMock).toHaveBeenCalledWith(
            "user-1",
            "guild-1",
            400,
            "bank",
            "wallet",
        );
        expect(sendSimpleEmbedMock).toHaveBeenCalledWith(
            interaction,
            expect.objectContaining({
                title: "Withdrawal completed ✅ ",
            }),
        );
    });

    it("shows insufficient funds instead of success when the bank cannot cover it", async () => {
        const interaction = createInteraction(400, true);
        transferInternalSafeMock.mockResolvedValue({
            ok: false,
            reason: "insufficient_funds",
            currentBalance: 0,
        });

        await withdrawCommand.execute(interaction);

        expect(insufficientFundsMock).toHaveBeenCalledWith(
            interaction,
            0,
            400,
            "$",
            "withdraw",
        );
        expect(sendSimpleEmbedMock).not.toHaveBeenCalled();
    });
});
