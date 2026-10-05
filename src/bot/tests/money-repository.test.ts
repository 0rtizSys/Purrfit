import { pool } from "../services/database/db";
import { claimWorkReward } from "../services/database/repository/clients/work";
import { transferSafe } from "../services/database/repository/clients/transaction";
import { transferInternalSafe } from "../services/database/repository/clients/withdraw-transfer";
import { removeBalance } from "../services/database/repository/clients/manager";

jest.mock("../services/database/db", () => ({
    pool: {
        connect: jest.fn(),
        query: jest.fn(),
    },
}));

type QueryResult = { rows?: Record<string, unknown>[]; rowCount?: number };

const connectMock = pool.connect as jest.Mock;
const poolQueryMock = pool.query as jest.Mock;

/**
 * Fake client: `handler` answers non-control queries in order;
 * BEGIN/COMMIT/ROLLBACK are recorded and answered with {}.
 */
function createClient(
    handler: (sql: string, params?: unknown[]) => QueryResult,
) {
    const client = {
        query: jest.fn(async (sql: string, params?: unknown[]) => {
            if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql.trim())) return {};
            return handler(sql, params);
        }),
        release: jest.fn(),
    };
    connectMock.mockResolvedValue(client);
    return client;
}

function controlStatements(client: { query: jest.Mock }) {
    return client.query.mock.calls
        .map(([sql]) => String(sql).trim())
        .filter((sql) => ["BEGIN", "COMMIT", "ROLLBACK"].includes(sql));
}

beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(Date, "now").mockReturnValue(1_000_000);
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe("claimWorkReward", () => {
    it("claims the cooldown and pays in the same transaction", async () => {
        const client = createClient((sql) => {
            if (sql.includes("INSERT INTO cooldowns_table"))
                return { rowCount: 1, rows: [{ cooldown: "1060000" }] };
            if (sql.includes("INSERT INTO clients"))
                return { rowCount: 1, rows: [{ wallet: "600" }] };
            throw new Error(`unexpected query: ${sql}`);
        });

        const result = await claimWorkReward("user-1", "guild-1", 500, 60_000);

        expect(result).toEqual({ ok: true, newBalance: 600 });
        const claimCall = client.query.mock.calls.find(([sql]) =>
            String(sql).includes("INSERT INTO cooldowns_table"),
        )!;
        //? Only overwrites an expired cooldown
        expect(claimCall[0]).toContain("WHERE cooldowns_table.cooldown <= $4");
        expect(claimCall[1]).toEqual([
            "guild-1",
            "user-1",
            1_060_000,
            1_000_000,
        ]);
        expect(controlStatements(client)).toEqual(["BEGIN", "COMMIT"]);
        expect(client.release).toHaveBeenCalledTimes(1);
    });

    it("does not pay when the cooldown is still active", async () => {
        const client = createClient((sql) => {
            if (sql.includes("INSERT INTO cooldowns_table"))
                return { rowCount: 0, rows: [] };
            if (sql.includes("SELECT cooldown"))
                return { rowCount: 1, rows: [{ cooldown: "1030000" }] };
            throw new Error(`unexpected query: ${sql}`);
        });

        const result = await claimWorkReward("user-1", "guild-1", 500, 60_000);

        expect(result).toEqual({
            ok: false,
            reason: "cooldown",
            remaining: 30_000,
        });
        expect(
            client.query.mock.calls.some(([sql]) =>
                String(sql).includes("INSERT INTO clients"),
            ),
        ).toBe(false);
    });

    it("rolls back and rethrows when the payout fails", async () => {
        const client = createClient((sql) => {
            if (sql.includes("INSERT INTO cooldowns_table"))
                return { rowCount: 1, rows: [] };
            throw new Error("db down");
        });

        await expect(
            claimWorkReward("user-1", "guild-1", 500, 60_000),
        ).rejects.toThrow("db down");
        expect(controlStatements(client)).toEqual(["BEGIN", "ROLLBACK"]);
        expect(client.release).toHaveBeenCalledTimes(1);
    });
});

describe("transferSafe", () => {
    it("locks both rows in a fixed order and moves the money", async () => {
        const client = createClient((sql) => {
            if (sql.includes("FOR UPDATE"))
                return {
                    rowCount: 2,
                    rows: [
                        { user_id: "a-user", bank: "0" },
                        { user_id: "z-user", bank: "500" },
                    ],
                };
            return { rowCount: 1, rows: [] };
        });

        const result = await transferSafe("z-user", "a-user", "guild-1", 200);

        expect(result).toEqual({ ok: true, received: 200, tax: 0 });
        const [insertCall, lockCall, , updateCall] =
            client.query.mock.calls.filter(
                ([sql]) => !["BEGIN", "COMMIT"].includes(String(sql).trim()),
            );
        //? Ids are sorted regardless of who sends, preventing A<->B deadlocks
        expect(insertCall[1]).toEqual(["a-user", "z-user", "guild-1"]);
        expect(lockCall[0]).toContain("ORDER BY user_id");
        expect(lockCall[1]).toEqual(["guild-1", ["a-user", "z-user"]]);
        expect(updateCall[1]).toEqual([
            "z-user",
            "a-user",
            200,
            "guild-1",
            200,
        ]);
        expect(controlStatements(client)).toEqual(["BEGIN", "COMMIT"]);
    });

    it("takes the server tax from the received amount and sends it to the treasury", async () => {
        const client = createClient((sql) => {
            if (sql.includes("FOR UPDATE"))
                return {
                    rowCount: 2,
                    rows: [
                        { user_id: "a-user", bank: "0" },
                        { user_id: "z-user", bank: "500" },
                    ],
                };
            if (sql.includes("SELECT tax_bps"))
                return { rowCount: 1, rows: [{ tax_bps: 250 }] };
            return { rowCount: 1, rows: [] };
        });

        const result = await transferSafe("z-user", "a-user", "guild-1", 200);

        expect(result).toEqual({ ok: true, received: 195, tax: 5 });
        const update = client.query.mock.calls.find(([sql]) =>
            String(sql).includes("UPDATE clients"),
        );
        expect(update?.[1]).toEqual(["z-user", "a-user", 200, "guild-1", 195]);
        const treasury = client.query.mock.calls.find(([sql]) =>
            String(sql).includes("treasury"),
        );
        expect(treasury?.[1]).toEqual(["guild-1", 5]);
    });

    it("returns insufficient funds without updating", async () => {
        const client = createClient((sql) => {
            if (sql.includes("FOR UPDATE"))
                return {
                    rowCount: 2,
                    rows: [
                        { user_id: "a-user", bank: "0" },
                        { user_id: "z-user", bank: "50" },
                    ],
                };
            return { rowCount: 1, rows: [] };
        });

        const result = await transferSafe("z-user", "a-user", "guild-1", 200);

        expect(result).toEqual({
            ok: false,
            reason: "insufficient_funds",
            currentBalance: 50,
        });
        expect(
            client.query.mock.calls.some(([sql]) =>
                String(sql).includes("UPDATE clients"),
            ),
        ).toBe(false);
    });

    it("rejects self transfers before opening a transaction", async () => {
        await expect(
            transferSafe("user-1", "user-1", "guild-1", 10),
        ).rejects.toThrow();
        expect(connectMock).not.toHaveBeenCalled();
    });
});

describe("transferInternalSafe", () => {
    it("treats a user without a row as having 0", async () => {
        createClient(() => ({ rowCount: 0, rows: [] }));

        const result = await transferInternalSafe(
            "user-1",
            "guild-1",
            10,
            "wallet",
            "bank",
        );

        expect(result).toEqual({
            ok: false,
            reason: "insufficient_funds",
            currentBalance: 0,
        });
    });

    it("rejects column names outside the allowlist", async () => {
        await expect(
            transferInternalSafe(
                "user-1",
                "guild-1",
                10,
                "wallet; DROP TABLE clients" as "wallet",
                "bank",
            ),
        ).rejects.toThrow("Invalid balance types");
        expect(connectMock).not.toHaveBeenCalled();
    });
});

describe("removeBalance", () => {
    it("returns null instead of creating money when funds are insufficient", async () => {
        poolQueryMock.mockResolvedValue({ rowCount: 0, rows: [] });

        const result = await removeBalance("user-1", "guild-1", "wallet", 100);

        expect(result).toBeNull();
        expect(poolQueryMock.mock.calls[0][0]).not.toContain("INSERT");
    });
});
