// ? =========================
// ? Utils
// ? =========================

import { pingSlash } from "./commands/utils/ping.js";
import { helpCommand } from "./commands/utils/help.js";
import { deleteMyDataCommand } from "./commands/utils/delete_my_data.js";

// ! =========================
// ! Development
// ! =========================

import { syncSlash } from "./commands/dev/sync_slash.js";

// * =========================
// * Economy - Public
// * =========================

import { getWalletBalance } from "./commands/economy/public/wallet.js";
import { workCommand } from "./commands/economy/public/work.js";
import { getBankBalance } from "./commands/economy/public/bank.js";
import { transferCommand } from "./commands/economy/public/transfer.js";
import { withdrawCommand } from "./commands/economy/public/withdraw.js";
import { depositCommand } from "./commands/economy/public/deposit.js";
import { leaderboardCommand } from "./commands/economy/public/leaderboard.js";
import { economyInfoCommand } from "./commands/economy/public/economy_info.js";
import { cryptoCommand } from "./commands/economy/public/crypto.js";

// * =========================
// * Games
// * =========================

import { coinFlipCommand } from "./commands/games/coin_flip.js";

// * =========================
// * Economy - Moderators
// * =========================

import { addBalanceCommand } from "./commands/economy/moderators/add_balance.js";

// * =========================
// * Economy - Admin
// * =========================

import { setCdTimeAdmin } from "./commands/economy/admin/set_cd_time.admin.js";
import { setEconomySymbolAdmin } from "./commands/economy/admin/set_eco_symbol.admin.js";
import { setTaxRateAdmin } from "./commands/economy/admin/set_tax_rate.admin.js";
import { setInterestRateAdmin } from "./commands/economy/admin/set_interest_rate.admin.js";

// ! =========================
// ! Command Registry
// ! =========================

//? Public commands are registered globally (every server that adds the bot).
//? Grouped by category for /help; order here is the order shown there.
export const commandCategories = [
    {
        title: "💰 Economy",
        commands: [
            workCommand,
            getWalletBalance,
            getBankBalance,
            depositCommand,
            withdrawCommand,
            transferCommand,
            leaderboardCommand,
            economyInfoCommand,
        ],
    },
    { title: "📈 Crypto", commands: [cryptoCommand] },
    { title: "🎲 Games", commands: [coinFlipCommand] },
    {
        title: "🛠️ Admin",
        commands: [
            addBalanceCommand,
            setCdTimeAdmin,
            setEconomySymbolAdmin,
            setTaxRateAdmin,
            setInterestRateAdmin,
        ],
    },
    {
        title: "ℹ️ Utility",
        commands: [helpCommand, pingSlash, deleteMyDataCommand],
    },
];

export const publicCmds = commandCategories.flatMap((c) => c.commands);

//! Developer commands are only registered in GUILD_ID (your own server)
export const devCmds = [syncSlash];

export const cmds = [...publicCmds, ...devCmds];
