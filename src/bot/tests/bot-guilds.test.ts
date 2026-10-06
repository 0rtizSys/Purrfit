import { toGuildRow } from "../services/database/repository/servers/bot_guilds";

jest.mock("../services/database/db", () => ({
    pool: { query: jest.fn() },
}));

describe("toGuildRow", () => {
    it("keeps the fields the dashboard needs", () => {
        expect(
            toGuildRow({
                id: "123456789012345678",
                name: "Cat Café",
                icon: "a".repeat(32),
                memberCount: 42,
            }),
        ).toEqual({
            id: "123456789012345678",
            name: "Cat Café",
            icon: "a".repeat(32),
            memberCount: 42,
        });
    });

    it("fits the column limits and handles servers without an icon", () => {
        const row = toGuildRow({
            id: "123456789012345678",
            name: "x".repeat(150),
            icon: null,
            memberCount: -3,
        });
        expect(row.name).toHaveLength(100);
        expect(row.icon).toBeNull();
        expect(row.memberCount).toBe(0);
    });

    it("never stores an empty name", () => {
        expect(
            toGuildRow({
                id: "123456789012345678",
                name: "",
                icon: null,
                memberCount: 1,
            }).name,
        ).toBe("Unknown");
    });
});
