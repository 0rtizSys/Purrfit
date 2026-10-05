import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { buildSnapshot, writeSnapshot } from "../market_snapshot";

describe("market snapshot", () => {
    it("calcula el cambio de 24h en porcentaje", () => {
        const snap = buildSnapshot(
            [
                {
                    symbol: "PURR",
                    name: "Purrcoin",
                    price: 110,
                    price24hAgo: 100,
                },
                { symbol: "NIP", name: "Catnip", price: 5, price24hAgo: 0 },
            ],
            new Date("2026-01-01T00:00:00Z"),
        );
        expect(snap.updatedAt).toBe("2026-01-01T00:00:00.000Z");
        expect(snap.assets[0].change24hPct).toBeCloseTo(10);
        expect(snap.assets[1].change24hPct).toBe(0);
    });

    it("escribe el archivo y no deja temporales", () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "snap-"));
        const file = path.join(dir, "nested", "market.json");
        writeSnapshot(buildSnapshot([]), file);
        expect(JSON.parse(fs.readFileSync(file, "utf8")).assets).toEqual([]);
        expect(fs.readdirSync(path.dirname(file))).toEqual(["market.json"]);
    });
});
