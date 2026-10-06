import { checkPrefix, DEFAULT_PREFIX } from "../framework/prefix";

describe("checkPrefix", () => {
    it("the default prefix is valid", () => {
        expect(DEFAULT_PREFIX).toBe("$>");
        expect(checkPrefix(DEFAULT_PREFIX)).toEqual({ ok: true, prefix: "$>" });
    });

    it("accepts 1 to 5 characters, emoji included", () => {
        for (const ok of ["!", "p!", "$>", "purr!", "🐱", "🐱🐱🐱🐱🐱"])
            expect(checkPrefix(ok).ok).toBe(true);
    });

    it("rejects empty, too long and forbidden characters", () => {
        for (const bad of [
            "",
            "   ",
            "abcdef",
            "🐱🐱🐱🐱🐱🐱",
            "a b",
            "a`",
            "a\\",
            "@",
            "<@1>",
            "#chan",
        ])
            expect(checkPrefix(bad).ok).toBe(false);
    });

    it("trims the input before counting", () => {
        expect(checkPrefix("  !  ")).toEqual({ ok: true, prefix: "!" });
    });
});
