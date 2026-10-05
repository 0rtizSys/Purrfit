import { pool } from "../../db";
import {
    DEFAULT_INTEREST_BPS,
    DEFAULT_TAX_BPS,
    MAX_INTEREST_BPS,
    MAX_TAX_BPS,
} from "../../../economy/policy";

export type EconomySettings = {
    taxBps: number;
    interestBps: number;
    treasury: number;
};

export async function getEconomySettings(
    guildId: string,
): Promise<EconomySettings> {
    const result = await pool.query(
        `SELECT tax_bps, bank_interest_bps, treasury
         FROM server_configurations WHERE guild_id = $1`,
        [guildId],
    );
    const row = result.rows[0];
    return {
        taxBps: Number(row?.tax_bps ?? DEFAULT_TAX_BPS),
        interestBps: Number(row?.bank_interest_bps ?? DEFAULT_INTEREST_BPS),
        treasury: Number(row?.treasury ?? 0),
    };
}

export async function setTaxRate(guildId: string, bps: number): Promise<void> {
    if (!Number.isInteger(bps) || bps < 0 || bps > MAX_TAX_BPS)
        throw new Error("Invalid tax rate");
    await pool.query(
        `INSERT INTO server_configurations (guild_id, tax_bps) VALUES ($1, $2)
         ON CONFLICT (guild_id) DO UPDATE SET tax_bps = EXCLUDED.tax_bps`,
        [guildId, bps],
    );
}

export async function setInterestRate(
    guildId: string,
    bps: number,
): Promise<void> {
    if (!Number.isInteger(bps) || bps < 0 || bps > MAX_INTEREST_BPS)
        throw new Error("Invalid interest rate");
    await pool.query(
        `INSERT INTO server_configurations (guild_id, bank_interest_bps) VALUES ($1, $2)
         ON CONFLICT (guild_id) DO UPDATE SET bank_interest_bps = EXCLUDED.bank_interest_bps`,
        [guildId, bps],
    );
}
