import type { EmbedBuilder } from "discord.js";
import type { Replier } from "../framework/types";
import {
    formatDuration,
    money,
    moneyChange,
    moneyText,
    relativeTime,
    signedMoney,
} from "../ui/format";
import { toneColor } from "../ui/theme";
import {
    buildEmbed,
    sendSimpleEmbed,
} from "../Helpers/simplified_embed_builder";

describe("ui/format", () => {
    it("formats money with thousands separators and no space", () => {
        expect(moneyText("$", 1234567)).toBe("$1,234,567");
        expect(moneyText("$", -50)).toBe("-$50");
        expect(money("🪙", 1000)).toBe("`🪙1,000`");
        expect(signedMoney("$", 250)).toBe("`+$250`");
        expect(signedMoney("$", -250)).toBe("`-$250`");
        expect(moneyChange("$", 100, 3500)).toBe("`$100` → `$3,500`");
    });

    it("formats durations with at most two units", () => {
        expect(formatDuration(0)).toBe("0s");
        expect(formatDuration(45)).toBe("45s");
        expect(formatDuration(90)).toBe("1m 30s");
        expect(formatDuration(7200)).toBe("2h");
        expect(formatDuration(93_784)).toBe("1d 2h");
    });

    it("renders Discord relative timestamps in seconds", () => {
        expect(relativeTime(1_700_000_000_999)).toBe("<t:1700000000:R>");
    });
});

function fakeReplier() {
    return {
        client: { user: { displayAvatarURL: () => "https://bot/avatar.png" } },
        prefix: "$>",
        send: jest.fn().mockResolvedValue(undefined),
    } as unknown as Replier & { send: jest.Mock };
}

describe("embed builder", () => {
    it("colors by tone, adds the footer and the hint line", () => {
        const embed = buildEmbed(fakeReplier(), {
            title: "Title",
            description: "Body",
            hint: "Do this",
            tone: "success",
        }).toJSON();
        expect(embed.color).toBe(toneColor("success"));
        expect(embed.description).toBe("Body\n-# 💡 Do this");
        expect(embed.footer?.text).toBe("Purrfit");
    });

    it("errors have no footer and are temporary", async () => {
        const replier = fakeReplier();
        await sendSimpleEmbed(replier, { title: "x", tone: "error" });
        const [payload, options] = replier.send.mock.calls[0] as [
            { embeds: EmbedBuilder[] },
            { temporary: boolean },
        ];
        expect(options.temporary).toBe(true);
        expect(payload.embeds[0].toJSON().footer).toBeUndefined();
    });

    it("cooldown notices and `eph` replies are temporary too", async () => {
        const replier = fakeReplier();
        await sendSimpleEmbed(replier, { title: "x", tone: "cooldown" });
        await sendSimpleEmbed(replier, { title: "x", eph: true });
        expect(replier.send.mock.calls.map((c) => c[1].temporary)).toEqual([
            true,
            true,
        ]);
    });

    it("normal replies stay in the channel and carry files and buttons", async () => {
        const replier = fakeReplier();
        await sendSimpleEmbed(replier, {
            title: "x",
            files: [],
            components: [],
        });
        const [payload, options] = replier.send.mock.calls[0];
        expect(options.temporary).toBe(false);
        expect(payload).toEqual(
            expect.objectContaining({ files: [], components: [] }),
        );
    });
});
