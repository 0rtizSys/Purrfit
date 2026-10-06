import { leaderboardCommand } from "../commands/economy/public/leaderboard";
import { economyInfoCommand } from "../commands/economy/public/economy_info";
import {
    getLeaderboard,
    getUserRank,
} from "../services/database/repository/clients/leaderboard";
import { getEcoSymbol } from "../services/database/repository/servers/get_eco_symbol";
import { getCdTime } from "../services/database/repository/servers/get_cd_time";
import { getEconomySettings } from "../services/database/repository/servers/economy_settings";
import { usageOf } from "../framework/args";
import { fakeCtx } from "./helpers/fake_context";

jest.mock("../services/database/repository/clients/leaderboard", () => ({
    getLeaderboard: jest.fn(),
    getUserRank: jest.fn(),
}));
jest.mock("../services/database/repository/servers/get_eco_symbol", () => ({
    getEcoSymbol: jest.fn(),
}));
jest.mock("../services/database/repository/servers/get_cd_time", () => ({
    getCdTime: jest.fn(),
}));
jest.mock("../services/database/repository/servers/economy_settings", () => ({
    getEconomySettings: jest.fn(),
}));

const withGuild = <T extends { ctx: unknown }>(made: T): T => {
    (made.ctx as { guild: unknown }).guild = {
        id: "guild-1",
        name: "Cat Club",
        iconURL: () => null,
    };
    return made;
};

beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getEcoSymbol).mockResolvedValue("$");
});

describe("leaderboardCommand", () => {
    it("declares its contract", () => {
        expect(usageOf(leaderboardCommand)).toBe(
            "leaderboard [total|wallet|bank]",
        );
        expect(leaderboardCommand.aliases).toEqual(["lb", "top"]);
    });

    it("ranks by total by default and highlights the caller", async () => {
        jest.mocked(getLeaderboard).mockResolvedValue([
            { userId: "user-2", total: 900, wallet: 400, bank: 500 },
            { userId: "user-1", total: 100, wallet: 100, bank: 0 },
        ] as never);
        jest.mocked(getUserRank).mockResolvedValue(2);
        const { ctx, replies } = withGuild(fakeCtx());

        await leaderboardCommand.execute!(ctx);

        expect(getLeaderboard).toHaveBeenCalledWith("guild-1", "total");
        expect(getUserRank).toHaveBeenCalledWith("user-1", "guild-1", "total");
        const [reply] = replies();
        expect(reply.embed.title).toContain("Cat Club leaderboard");
        expect(reply.embed.description).toContain("Ranked by **Total**");
        expect(reply.embed.description).toContain("← you");
        expect(reply.embed.fields?.[0].value).toBe("**#2**");
        expect(reply.temporary).toBe(false);
    });

    it("uses the chosen sort", async () => {
        jest.mocked(getLeaderboard).mockResolvedValue([] as never);
        jest.mocked(getUserRank).mockResolvedValue(null as never);
        const { ctx } = withGuild(fakeCtx({ args: { by: "bank" } }));

        await leaderboardCommand.execute!(ctx);

        expect(getLeaderboard).toHaveBeenCalledWith("guild-1", "bank");
    });

    it("suggests the work command with the server prefix when empty", async () => {
        jest.mocked(getLeaderboard).mockResolvedValue([] as never);
        jest.mocked(getUserRank).mockResolvedValue(null as never);
        const { ctx, replies } = withGuild(fakeCtx({ prefix: "p!" }));

        await leaderboardCommand.execute!(ctx);

        const [reply] = replies();
        expect(reply.embed.description).toContain("`p!work`");
        expect(reply.embed.fields?.[0].value).toBe("Not ranked yet");
    });
});

describe("economyInfoCommand", () => {
    it("declares its contract", () => {
        expect(usageOf(economyInfoCommand)).toBe("economy_info");
        expect(economyInfoCommand.aliases).toEqual(["eco", "info"]);
    });

    it("shows the server economy settings publicly", async () => {
        jest.mocked(getCdTime).mockResolvedValue(3600);
        jest.mocked(getEconomySettings).mockResolvedValue({
            taxBps: 500,
            interestBps: 100,
            treasury: 1234,
        } as never);
        const { ctx, replies } = withGuild(fakeCtx());

        await economyInfoCommand.execute!(ctx);

        expect(ctx.defer).toHaveBeenCalled();
        const [reply] = replies();
        expect(reply.embed.title).toContain("Cat Club economy");
        expect(reply.embed.fields?.map((f) => f.name)).toEqual(
            expect.arrayContaining([
                "Currency",
                expect.stringContaining("Treasury"),
            ]),
        );
        expect(reply.embed.fields?.[0].value).toBe("`$`");
        expect(reply.temporary).toBe(false);
    });
});
