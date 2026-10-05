/**
 * Integration tests against a real PostgreSQL database.
 * Skipped unless TEST_DATABASE_URL is set (CI sets it with a Postgres service).
 * WARNING: they wipe the economy tables, never point them at production.
 */
import type { Pool } from "pg";

const url = process.env.TEST_DATABASE_URL;
const describeDb = url ? describe : describe.skip;

type Modules = {
    pool: Pool;
    runMigrations: typeof import("../../../scripts/migrate").runMigrations;
    market: typeof import("../../services/database/repository/crypto/market");
    transferSafe: typeof import("../../services/database/repository/clients/transaction").transferSafe;
    runBankInterest: typeof import("../../services/database/repository/jobs/bank_interest").runBankInterest;
    runMarketTick: typeof import("../../services/database/repository/jobs/market_tick").runMarketTick;
    leaderboard: typeof import("../../services/database/repository/clients/leaderboard");
    deleteUserData: typeof import("../../services/database/repository/clients/delete_data").deleteUserData;
};

let m: Modules;
const G = "guild-int";

async function wallet(user: string) {
    const r = await m.pool.query(
        "SELECT wallet, bank FROM clients WHERE user_id=$1 AND guild_id=$2",
        [user, G],
    );
    return {
        wallet: Number(r.rows[0]?.wallet ?? 0),
        bank: Number(r.rows[0]?.bank ?? 0),
    };
}

describeDb("economy against PostgreSQL", () => {
    beforeAll(async () => {
        process.env.DATABASE_URL = url;
        process.env.DATABASE_SSL ??= "disable";
        const { pool } = await import("../../services/database/db");
        m = {
            pool,
            runMigrations: (await import("../../../scripts/migrate"))
                .runMigrations,
            market: await import("../../services/database/repository/crypto/market"),
            transferSafe: (
                await import("../../services/database/repository/clients/transaction")
            ).transferSafe,
            runBankInterest: (
                await import("../../services/database/repository/jobs/bank_interest")
            ).runBankInterest,
            runMarketTick: (
                await import("../../services/database/repository/jobs/market_tick")
            ).runMarketTick,
            leaderboard:
                await import("../../services/database/repository/clients/leaderboard"),
            deleteUserData: (
                await import("../../services/database/repository/clients/delete_data")
            ).deleteUserData,
        };
        await m.runMigrations(pool, () => undefined);
    });

    beforeEach(async () => {
        await m.pool.query(
            "TRUNCATE clients, cooldowns_table, server_configurations, crypto_holdings, crypto_price_history",
        );
        await m.pool.query("UPDATE crypto_assets SET price = base_price");
        await m.pool.query("UPDATE scheduled_jobs SET last_run = 'epoch'");
        await m.pool.query(
            "INSERT INTO clients (user_id, guild_id, wallet, bank) VALUES ('alice', $1, 10000, 5000), ('bob', $1, 0, 0)",
            [G],
        );
    });

    afterAll(async () => {
        await m?.pool.end();
    });

    it("migrations are idempotent", async () => {
        expect(await m.runMigrations(m.pool, () => undefined)).toEqual([]);
    });

    it("buys and sells crypto with tax going to the treasury", async () => {
        await m.pool.query(
            "INSERT INTO server_configurations (guild_id, tax_bps) VALUES ($1, 1000)",
            [G],
        );

        const bought = await m.market.buyCrypto("alice", G, "PURR", 2500);
        expect(bought).toMatchObject({
            ok: true,
            quantity: "2.50000000",
            newWallet: 7500,
        });

        const sold = await m.market.sellCrypto("alice", G, "PURR", "1");
        expect(sold).toMatchObject({
            ok: true,
            proceeds: 1000,
            tax: 100,
            newWallet: 8400,
        });

        const portfolio = await m.market.getPortfolio("alice", G);
        expect(portfolio).toEqual([
            expect.objectContaining({
                symbol: "PURR",
                quantity: "1.50000000",
                costBasis: 1500,
                value: 1500,
            }),
        ]);

        const rest = await m.market.sellCrypto("alice", G, "PURR", null);
        expect(rest).toMatchObject({
            ok: true,
            quantity: "1.50000000",
            proceeds: 1500,
            tax: 150,
        });
        expect(await m.market.getPortfolio("alice", G)).toEqual([]);

        const treasury = await m.pool.query(
            "SELECT treasury FROM server_configurations WHERE guild_id=$1",
            [G],
        );
        expect(Number(treasury.rows[0].treasury)).toBe(250);
    });

    it("rejects buys without funds and oversells", async () => {
        expect(await m.market.buyCrypto("bob", G, "PURR", 100)).toEqual({
            ok: false,
            reason: "insufficient_funds",
            currentBalance: 0,
        });
        expect(await m.market.buyCrypto("alice", G, "NOPE", 100)).toEqual({
            ok: false,
            reason: "unknown_coin",
        });
        await m.market.buyCrypto("alice", G, "WSK", 400);
        expect(
            await m.market.sellCrypto("alice", G, "WSK", "11"),
        ).toMatchObject({
            ok: false,
            reason: "insufficient_holdings",
        });
        expect(await m.market.sellCrypto("bob", G, "WSK", "1")).toEqual({
            ok: false,
            reason: "no_holdings",
        });
    });

    it("parallel buys cannot overdraw the wallet", async () => {
        const results = await Promise.all(
            Array.from({ length: 8 }, () =>
                m.market.buyCrypto("alice", G, "TUNA", 3000),
            ),
        );
        expect(results.filter((r) => r.ok)).toHaveLength(3);
        expect((await wallet("alice")).wallet).toBe(1000);
    });

    it("parallel sells cannot sell the same coins twice", async () => {
        await m.market.buyCrypto("alice", G, "TUNA", 1000);
        const results = await Promise.all(
            Array.from({ length: 6 }, () =>
                m.market.sellCrypto("alice", G, "TUNA", "400"),
            ),
        );
        expect(results.filter((r) => r.ok)).toHaveLength(2);
        expect((await wallet("alice")).wallet).toBe(9000 + 800);
    });

    it("transfers apply the server tax", async () => {
        await m.pool.query(
            "INSERT INTO server_configurations (guild_id, tax_bps) VALUES ($1, 500)",
            [G],
        );
        expect(await m.transferSafe("alice", "bob", G, 1000)).toEqual({
            ok: true,
            received: 950,
            tax: 50,
        });
        expect((await wallet("alice")).bank).toBe(4000);
        expect((await wallet("bob")).bank).toBe(950);
    });

    it("pays bank interest once per day, capped", async () => {
        await m.pool.query(
            "UPDATE clients SET bank = 50000000 WHERE user_id='bob' AND guild_id=$1",
            [G],
        );
        expect(await m.runBankInterest()).toEqual({
            ran: true,
            accountsPaid: 2,
        });
        expect(await m.runBankInterest()).toEqual({ ran: false });
        expect((await wallet("alice")).bank).toBe(5005); // 0.1% default
        expect((await wallet("bob")).bank).toBe(50010000); // capped at 10,000
    });

    it("ticks the market once per interval and backfills history", async () => {
        const first = await m.runMarketTick(new Date());
        expect(first).toMatchObject({ ran: true, updated: 5 });
        expect(first.ran && first.backfilled).toBeGreaterThan(0);
        expect(await m.runMarketTick(new Date())).toEqual({ ran: false });

        const history = await m.market.getPriceHistory("PURR", "24h");
        expect(history!.points.length).toBeGreaterThan(280);
        const market = await m.market.listMarket();
        expect(market.map((a) => a.symbol)).toContain("PURR");
    });

    it("ranks the leaderboard and deletes user data", async () => {
        const top = await m.leaderboard.getLeaderboard(G, "total");
        expect(top.map((e) => e.userId)).toEqual(["alice"]);
        expect(await m.leaderboard.getUserRank("alice", G, "total")).toBe(1);
        expect(await m.leaderboard.getUserRank("bob", G, "total")).toBeNull();

        await m.market.buyCrypto("alice", G, "PURR", 1000);
        await m.pool.query(
            "INSERT INTO cooldowns_table (guild_id, user_id, cooldown) VALUES ($1, 'alice', $2)",
            [G, Date.now() + 60_000],
        );
        expect(await m.deleteUserData("alice")).toEqual({
            balances: 1,
            holdings: 1,
            cooldowns: 0,
        });
        const cd = await m.pool.query(
            "SELECT 1 FROM cooldowns_table WHERE user_id='alice'",
        );
        expect(cd.rowCount).toBe(1);
    });
});
