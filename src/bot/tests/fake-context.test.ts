import { sendSimpleEmbed } from "../Helpers/simplified_embed_builder";
import { workCommand } from "../commands/economy/public/work";
import { fakeCtx } from "./helpers/fake_context";

jest.mock("../services/database/repository/clients/work", () => ({
    claimWorkReward: jest.fn(),
}));
jest.mock("../services/database/repository/servers/get_cd_time", () => ({
    getCdTime: jest.fn().mockResolvedValue(1800),
}));
jest.mock("../services/database/repository/servers/get_eco_symbol", () => ({
    getEcoSymbol: jest.fn().mockResolvedValue("$"),
}));
import { claimWorkReward } from "../services/database/repository/clients/work";

describe("fakeCtx with a real command", () => {
    it("lets a command be tested end to end", async () => {
        jest.mocked(claimWorkReward).mockResolvedValue({ ok: true } as never);
        const { ctx, replies } = fakeCtx({ userId: "u-9", guildId: "g-9" });
        await workCommand.execute!(ctx);
        expect(claimWorkReward).toHaveBeenCalledWith(
            "u-9",
            "g-9",
            expect.any(Number),
            1800_000,
        );
        const [reply] = replies();
        expect(reply.embed.title).toContain("Shift complete");
        expect(reply.temporary).toBe(false);
        expect(reply.embed.description).toMatch(/\$\d/);
    });

    it("marks a cooldown answer as temporary and uses the server prefix in hints", async () => {
        jest.mocked(claimWorkReward).mockResolvedValue({
            ok: false,
            remaining: 60_000,
        } as never);
        const { ctx, replies } = fakeCtx({ prefix: "p!" });
        await workCommand.execute!(ctx);
        expect(replies()[0].temporary).toBe(true);
        expect(replies()[0].embed.title).toContain("Taking a break");
    });

    it("exposes the same helpers the real replier does", async () => {
        const { ctx, replies } = fakeCtx({ prefix: "p!" });
        await sendSimpleEmbed(ctx, { title: "hi", hint: "x" });
        expect(replies()).toHaveLength(1);
    });
});
