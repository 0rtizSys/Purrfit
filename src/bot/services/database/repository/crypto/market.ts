import { pool } from "../../db";
import { withTransaction } from "../../transaction";
import { computeTax } from "../../../economy/policy";
import { addToTreasury, readTaxBps } from "../servers/treasury";

export type MarketAsset = {
    symbol: string;
    name: string;
    price: number;
    price24hAgo: number;
};

export type PricePoint = { at: Date; price: number };

export type Holding = {
    symbol: string;
    name: string;
    quantity: string;
    price: number;
    value: number;
    costBasis: number;
};

export type BuyResult =
    | { ok: true; quantity: string; price: number; newWallet: number }
    | { ok: false; reason: "unknown_coin" }
    | { ok: false; reason: "insufficient_funds"; currentBalance: number }
    | { ok: false; reason: "too_small" };

export type SellResult =
    | {
          ok: true;
          quantity: string;
          price: number;
          proceeds: number;
          tax: number;
          newWallet: number;
      }
    | { ok: false; reason: "unknown_coin" }
    | { ok: false; reason: "no_holdings" }
    | { ok: false; reason: "insufficient_holdings"; held: string }
    | { ok: false; reason: "too_small" };

export const CHART_RANGES = {
    "1h": "1 hour",
    "24h": "24 hours",
    "7d": "7 days",
    "30d": "30 days",
} as const;
export type ChartRange = keyof typeof CHART_RANGES;

//? Quantities travel as strings: they are NUMERIC(30,8) and must not lose
//? precision through JS floats. 8 decimals, no exponent notation.
export const QUANTITY_PATTERN = /^\d{1,22}(\.\d{1,8})?$/;

export function normalizeSymbol(input: string): string {
    return input.trim().toUpperCase();
}

export async function listMarket(): Promise<MarketAsset[]> {
    const result = await pool.query(
        `SELECT a.symbol, a.name, a.price,
                COALESCE(
                    (SELECT h.price FROM crypto_price_history h
                     WHERE h.symbol = a.symbol AND h.recorded_at <= now() - interval '24 hours'
                     ORDER BY h.recorded_at DESC LIMIT 1),
                    (SELECT h.price FROM crypto_price_history h
                     WHERE h.symbol = a.symbol
                     ORDER BY h.recorded_at ASC LIMIT 1),
                    a.price
                ) AS price_24h
         FROM crypto_assets a
         ORDER BY a.base_price DESC`,
    );
    return result.rows.map((row) => ({
        symbol: row.symbol,
        name: row.name,
        price: Number(row.price),
        price24hAgo: Number(row.price_24h),
    }));
}

export async function getPriceHistory(
    symbol: string,
    range: ChartRange,
): Promise<{ name: string; points: PricePoint[] } | null> {
    const asset = await pool.query(
        `SELECT name, price, updated_at FROM crypto_assets WHERE symbol = $1`,
        [symbol],
    );
    if (!asset.rowCount) return null;

    const history = await pool.query(
        `SELECT recorded_at, price FROM crypto_price_history
         WHERE symbol = $1 AND recorded_at >= now() - $2::interval
         ORDER BY recorded_at`,
        [symbol, CHART_RANGES[range]],
    );
    const points: PricePoint[] = history.rows.map((row) => ({
        at: new Date(row.recorded_at),
        price: Number(row.price),
    }));
    const current = asset.rows[0];
    const last = points[points.length - 1];
    if (!last || last.at.getTime() < new Date(current.updated_at).getTime()) {
        points.push({
            at: new Date(current.updated_at),
            price: Number(current.price),
        });
    }
    return { name: current.name, points };
}

/**
 * Spends `amount` from the wallet on `symbol` at the current price.
 * Wallet row and asset price are locked for the whole transaction, so a
 * price tick or a parallel command cannot change them halfway through.
 */
export async function buyCrypto(
    userId: string,
    guildId: string,
    symbol: string,
    amount: number,
): Promise<BuyResult> {
    return withTransaction(async (client) => {
        const priced = await client.query(
            `SELECT price, TRUNC($2::numeric / price, 8) AS quantity
             FROM crypto_assets WHERE symbol = $1 FOR SHARE`,
            [symbol, amount],
        );
        if (!priced.rowCount) return { ok: false, reason: "unknown_coin" };
        const price = Number(priced.rows[0].price);
        const quantity: string = priced.rows[0].quantity;
        if (Number(quantity) <= 0) return { ok: false, reason: "too_small" };

        const wallet = await client.query(
            `SELECT wallet FROM clients WHERE user_id = $1 AND guild_id = $2 FOR UPDATE`,
            [userId, guildId],
        );
        const balance = Number(wallet.rows[0]?.wallet ?? 0);
        if (balance < amount) {
            return {
                ok: false,
                reason: "insufficient_funds",
                currentBalance: balance,
            };
        }

        const updated = await client.query(
            `UPDATE clients SET wallet = wallet - $3
             WHERE user_id = $1 AND guild_id = $2 RETURNING wallet`,
            [userId, guildId, amount],
        );
        await client.query(
            `INSERT INTO crypto_holdings (user_id, guild_id, symbol, quantity, cost_basis)
             VALUES ($1, $2, $3, $4::numeric, $5)
             ON CONFLICT (user_id, guild_id, symbol) DO UPDATE
             SET quantity = crypto_holdings.quantity + EXCLUDED.quantity,
                 cost_basis = crypto_holdings.cost_basis + EXCLUDED.cost_basis`,
            [userId, guildId, symbol, quantity, amount],
        );
        return {
            ok: true,
            quantity,
            price,
            newWallet: Number(updated.rows[0].wallet),
        };
    });
}

/**
 * Sells `quantity` (or everything when null) of `symbol` into the wallet.
 * The server tax rate is applied to the proceeds and sent to the treasury.
 */
export async function sellCrypto(
    userId: string,
    guildId: string,
    symbol: string,
    quantity: string | null,
): Promise<SellResult> {
    if (quantity !== null && !QUANTITY_PATTERN.test(quantity))
        throw new Error("Invalid quantity");

    return withTransaction(async (client) => {
        const holding = await client.query(
            `SELECT quantity, cost_basis FROM crypto_holdings
             WHERE user_id = $1 AND guild_id = $2 AND symbol = $3 FOR UPDATE`,
            [userId, guildId, symbol],
        );
        if (!holding.rowCount || Number(holding.rows[0].quantity) <= 0) {
            const exists = await client.query(
                `SELECT 1 FROM crypto_assets WHERE symbol = $1`,
                [symbol],
            );
            return {
                ok: false,
                reason: exists.rowCount ? "no_holdings" : "unknown_coin",
            };
        }
        const held: string = holding.rows[0].quantity;
        const sellQuantity = quantity ?? held;

        const priced = await client.query(
            `SELECT price,
                    FLOOR($2::numeric * price)::bigint AS proceeds,
                    $2::numeric > $3::numeric AS exceeds,
                    $2::numeric = $3::numeric AS sells_all
             FROM crypto_assets WHERE symbol = $1 FOR SHARE`,
            [symbol, sellQuantity, held],
        );
        const row = priced.rows[0];
        if (row.exceeds)
            return { ok: false, reason: "insufficient_holdings", held };
        const proceeds = Number(row.proceeds);
        if (proceeds < 1 || Number(sellQuantity) <= 0)
            return { ok: false, reason: "too_small" };

        if (row.sells_all) {
            await client.query(
                `DELETE FROM crypto_holdings WHERE user_id = $1 AND guild_id = $2 AND symbol = $3`,
                [userId, guildId, symbol],
            );
        } else {
            //? Cost basis shrinks in proportion to the part that was sold
            await client.query(
                `UPDATE crypto_holdings
                 SET cost_basis = cost_basis - FLOOR(cost_basis * ($4::numeric / quantity))::bigint,
                     quantity = quantity - $4::numeric
                 WHERE user_id = $1 AND guild_id = $2 AND symbol = $3`,
                [userId, guildId, symbol, sellQuantity],
            );
        }

        const tax = computeTax(proceeds, await readTaxBps(client, guildId));
        const wallet = await client.query(
            `INSERT INTO clients (user_id, guild_id, wallet, bank)
             VALUES ($1, $2, $3, 0)
             ON CONFLICT (user_id, guild_id)
             DO UPDATE SET wallet = clients.wallet + EXCLUDED.wallet
             RETURNING wallet`,
            [userId, guildId, proceeds - tax],
        );
        await addToTreasury(client, guildId, tax);

        return {
            ok: true,
            quantity: sellQuantity,
            price: Number(row.price),
            proceeds,
            tax,
            newWallet: Number(wallet.rows[0].wallet),
        };
    });
}

export async function getPortfolio(
    userId: string,
    guildId: string,
): Promise<Holding[]> {
    const result = await pool.query(
        `SELECT h.symbol, a.name, h.quantity, a.price,
                FLOOR(h.quantity * a.price)::bigint AS value, h.cost_basis
         FROM crypto_holdings h
         JOIN crypto_assets a ON a.symbol = h.symbol
         WHERE h.user_id = $1 AND h.guild_id = $2 AND h.quantity > 0
         ORDER BY value DESC`,
        [userId, guildId],
    );
    return result.rows.map((row) => ({
        symbol: row.symbol,
        name: row.name,
        quantity: row.quantity,
        price: Number(row.price),
        value: Number(row.value),
        costBasis: Number(row.cost_basis),
    }));
}
