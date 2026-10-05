import {
    computeTax,
    formatBps,
    percentToBps,
} from "../services/economy/policy";
import {
    MAX_PRICE_FACTOR,
    MIN_PRICE_FACTOR,
    nextPrice,
    percentChange,
} from "../services/economy/market_sim";
import { renderPriceChart } from "../services/charts/price_chart";

describe("economy policy", () => {
    it("computes tax rounded down", () => {
        expect(computeTax(1000, 250)).toBe(25);
        expect(computeTax(199, 100)).toBe(1);
        expect(computeTax(99, 100)).toBe(0);
        expect(computeTax(1000, 0)).toBe(0);
    });

    it("converts and formats percentages", () => {
        expect(percentToBps(2.5)).toBe(250);
        expect(percentToBps(0.1)).toBe(10);
        expect(formatBps(250)).toBe("2.5%");
    });
});

describe("market simulation", () => {
    it("does not move without a shock at the base price", () => {
        expect(nextPrice(100, 100, 0.1, 300_000, 0)).toBe(100);
    });

    it("pulls prices back toward the base price", () => {
        expect(nextPrice(200, 100, 0.1, 86_400_000, 0)).toBeLessThan(200);
        expect(nextPrice(50, 100, 0.1, 86_400_000, 0)).toBeGreaterThan(50);
    });

    it("keeps prices inside their bounds", () => {
        expect(nextPrice(100, 100, 5, 86_400_000, -50)).toBe(
            100 * MIN_PRICE_FACTOR,
        );
        expect(nextPrice(100, 100, 5, 86_400_000, 50)).toBe(
            100 * MAX_PRICE_FACTOR,
        );
    });

    it("computes percent change", () => {
        expect(percentChange(100, 110)).toBeCloseTo(10);
        expect(percentChange(0, 10)).toBe(0);
    });

    it("renders a PNG chart", () => {
        const start = Date.UTC(2026, 0, 1);
        const points = Array.from({ length: 50 }, (_, i) => ({
            at: new Date(start + i * 300_000),
            price: 100 + Math.sin(i / 5) * 10,
        }));
        const png = renderPriceChart("Test", points);
        expect(png.subarray(1, 4).toString()).toBe("PNG");
    });
});
