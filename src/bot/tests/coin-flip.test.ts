import { settleCoinFlip } from "../services/games/coin_flip";

describe("settleCoinFlip", () => {
    it("returns a winning outcome when the selected side matches the flip", () => {
        const outcome = settleCoinFlip("heads", 100, () => "heads");

        expect(outcome).toEqual({
            choice: "heads",
            result: "heads",
            won: true,
            amount: 100,
            balanceDelta: 100,
        });
    });

    it("returns a losing outcome when the selected side does not match the flip", () => {
        const outcome = settleCoinFlip("heads", 100, () => "tails");

        expect(outcome).toEqual({
            choice: "heads",
            result: "tails",
            won: false,
            amount: 100,
            balanceDelta: -100,
        });
    });
});
