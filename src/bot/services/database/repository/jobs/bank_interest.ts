import { withTransaction } from "../../transaction";
import {
    BPS_DENOMINATOR,
    DEFAULT_INTEREST_BPS,
    MAX_DAILY_INTEREST,
} from "../../../economy/policy";

export type InterestResult =
    | { ran: false }
    | { ran: true; accountsPaid: number };

/**
 * Pays the daily bank interest once per UTC day.
 *
 * The claim on `scheduled_jobs` and the payout share one transaction, so a
 * crash rolls both back and a second bot instance cannot pay twice.
 * Each account earns at most MAX_DAILY_INTEREST per day.
 */
export async function runBankInterest(): Promise<InterestResult> {
    return withTransaction(async (client) => {
        const claim = await client.query(
            `UPDATE scheduled_jobs SET last_run = now()
             WHERE name = 'bank_interest'
               AND last_run < date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
             RETURNING last_run`,
        );
        if (!claim.rowCount) return { ran: false };

        const paid = await client.query(
            `WITH rates AS (
                 SELECT c.user_id, c.guild_id,
                        LEAST(
                            FLOOR(c.bank * COALESCE(s.bank_interest_bps, $1) / $2::numeric),
                            $3
                        )::bigint AS interest
                 FROM clients c
                 LEFT JOIN server_configurations s ON s.guild_id = c.guild_id
                 WHERE c.bank > 0
             )
             UPDATE clients c SET bank = c.bank + r.interest
             FROM rates r
             WHERE c.user_id = r.user_id AND c.guild_id = r.guild_id AND r.interest > 0`,
            [DEFAULT_INTEREST_BPS, BPS_DENOMINATOR, MAX_DAILY_INTEREST],
        );
        return { ran: true, accountsPaid: paid.rowCount ?? 0 };
    });
}
