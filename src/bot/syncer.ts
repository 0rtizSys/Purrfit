// ? =========================
// ? Slash commands (the only ones left)
// ? =========================

import type { Command } from "./commands/types.js";
import { helpCommand } from "./commands/utils/help.js";
import { dashboardCommand } from "./commands/utils/dashboard.js";
import { supportCommand } from "./commands/utils/support.js";

// ? =========================
// ? Prefix commands: Utils
// ? =========================

import { pingCommand } from "./commands/utils/ping.js";
import { prefixCommand } from "./commands/utils/prefix.js";
import { deleteMyDataCommand } from "./commands/utils/delete_my_data.js";

// ! =========================
// ! Development
// ! =========================

import { syncCommands } from "./commands/dev/sync.js";

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

import { buildRegistry } from "./framework/registry.js";
import type { CommandCategory } from "./framework/types.js";

// ! =========================
// ! Command Registry
// ! =========================

//? Everything is a prefix command (`$>work`) except these three, which stay
//? slash commands and are published globally by `npm run deploy-commands`.
export const slashCmds: Command[] = [
    helpCommand,
    dashboardCommand,
    supportCommand,
];

//? Grouped by category for /help and the dashboard; the order here is the
//? order shown there. `owner` commands are hidden from both.
export const commandCategories: CommandCategory[] = [
    {
        id: "economy",
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
    { id: "crypto", title: "📈 Crypto", commands: [cryptoCommand] },
    { id: "games", title: "🎲 Games", commands: [coinFlipCommand] },
    {
        id: "admin",
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
        id: "utility",
        title: "ℹ️ Utility",
        commands: [prefixCommand, pingCommand, deleteMyDataCommand],
    },
    //! Developer commands: owner-only, never listed in /help or the dashboard
    { id: "dev", title: "🧪 Developer", commands: [syncCommands] },
];

export const prefixCmds = commandCategories.flatMap((c) => c.commands);

//? Throws at startup if two commands share a name or an alias
export const registry = buildRegistry(prefixCmds);
