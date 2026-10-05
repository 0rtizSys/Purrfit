import { ChatInputCommandInteraction } from "discord.js";
import { addBalanceCommand } from "../commands/economy/moderators/add_balance";
import { setEconomySymbolAdmin } from "../commands/economy/admin/set_eco_symbol.admin";
import { addBalance } from "../services/database/repository/clients/manager";
import { setEcoSymbol } from "../services/database/repository/servers/set_eco_symbol";
import { notEnoughPermsEmbed } from "../Helpers/simplified_embed_builder";

jest.mock("../services/database/repository/clients/manager", () => ({
    addBalance: jest.fn(),
}));
jest.mock("../services/database/repository/servers/set_eco_symbol", () => ({
    setEcoSymbol: jest.fn(),
}));
jest.mock("../services/database/repository/servers/get_eco_symbol", () => ({
    getEcoSymbol: jest.fn().mockResolvedValue("$"),
}));
jest.mock("../Helpers/simplified_embed_builder", () => ({
    sendSimpleEmbed: jest.fn(),
    internalErrorEmbed: jest.fn(),
    notEnoughPermsEmbed: jest.fn(),
}));

function createInteraction(isAdmin: boolean) {
    return {
        inGuild: jest.fn().mockReturnValue(true),
        guild: { id: "guild-1" },
        user: { id: "user-1", toString: () => "<@user-1>" },
        memberPermissions: { has: jest.fn().mockReturnValue(isAdmin) },
        options: {
            getString: jest.fn((name: string) =>
                name === "method" ? "wallet" : "€",
            ),
            getInteger: jest.fn().mockReturnValue(1000),
            getUser: jest.fn().mockReturnValue({ id: "user-2", bot: false }),
            getBoolean: jest.fn().mockReturnValue(false),
        },
        deferReply: jest.fn().mockResolvedValue(undefined),
        deferred: false,
        replied: false,
    } as unknown as ChatInputCommandInteraction & { deferReply: jest.Mock };
}

beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(setEcoSymbol).mockResolvedValue(true);
    jest.mocked(addBalance).mockResolvedValue(1000);
});

describe("admin-only commands", () => {
    it("add_balance does nothing for non-admins", async () => {
        const interaction = createInteraction(false);

        await addBalanceCommand.execute(interaction);

        expect(notEnoughPermsEmbed).toHaveBeenCalledWith(interaction);
        expect(addBalance).not.toHaveBeenCalled();
        expect(interaction.deferReply).not.toHaveBeenCalled();
    });

    it("set_economy_symbol does not save for non-admins", async () => {
        const interaction = createInteraction(false);

        await setEconomySymbolAdmin.execute(interaction);

        expect(notEnoughPermsEmbed).toHaveBeenCalledWith(interaction);
        expect(setEcoSymbol).not.toHaveBeenCalled();
    });

    it("admins can still use both commands", async () => {
        await addBalanceCommand.execute(createInteraction(true));
        await setEconomySymbolAdmin.execute(createInteraction(true));

        expect(addBalance).toHaveBeenCalledWith(
            "user-2",
            "guild-1",
            "wallet",
            1000,
        );
        expect(setEcoSymbol).toHaveBeenCalledWith("guild-1", "€");
    });
});
