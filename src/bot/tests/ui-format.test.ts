import { EmbedBuilder, MessageFlags } from "discord.js";
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

function fakeInteraction(state: {
    deferred?: boolean;
    replied?: boolean;
    ephemeral?: boolean | null;
}) {
    return {
        deferred: false,
        replied: false,
        ephemeral: null,
        ...state,
        client: { user: { displayAvatarURL: () => "https://bot/avatar.png" } },
        reply: jest.fn(),
        editReply: jest.fn(),
        deleteReply: jest.fn(),
        followUp: jest.fn(),
    } as unknown as Parameters<typeof sendSimpleEmbed>[0];
}

describe("embed builder", () => {
    it("colors by tone, adds the footer and the hint line", () => {
        const embed = buildEmbed(fakeInteraction({}), {
            title: "Title",
            description: "Body",
            hint: "Do this",
            tone: "success",
        }).toJSON();
        expect(embed.color).toBe(toneColor("success"));
        expect(embed.description).toBe("Body\n-# 💡 Do this");
        expect(embed.footer?.text).toBe("Purrfit");
    });

    it("errors have no footer and are ephemeral", async () => {
        const interaction = fakeInteraction({});
        await sendSimpleEmbed(interaction, { title: "x", tone: "error" });
        const call = jest.mocked(interaction.reply).mock.calls[0][0] as {
            embeds: EmbedBuilder[];
            flags: number;
        };
        expect(call.flags).toBe(MessageFlags.Ephemeral);
        expect(call.embeds[0].toJSON().footer).toBeUndefined();
    });

    it("moves an error after a public defer into a private follow-up", async () => {
        const interaction = fakeInteraction({
            deferred: true,
            ephemeral: false,
        });
        await sendSimpleEmbed(interaction, { title: "x", tone: "error" });
        expect(interaction.deleteReply).toHaveBeenCalled();
        expect(interaction.followUp).toHaveBeenCalledWith(
            expect.objectContaining({ flags: MessageFlags.Ephemeral }),
        );
        expect(interaction.editReply).not.toHaveBeenCalled();
    });

    it("edits a private deferred reply in place", async () => {
        const interaction = fakeInteraction({
            deferred: true,
            ephemeral: true,
        });
        await sendSimpleEmbed(interaction, { title: "x", tone: "error" });
        expect(interaction.editReply).toHaveBeenCalled();
        expect(interaction.deleteReply).not.toHaveBeenCalled();
    });
});
