import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { buildManifest } from "../bot/framework/manifest";
import { commandCategories, slashCmds } from "../bot/syncer";

//? Writes the command list for the web dashboard (see framework/manifest.ts).
//? Default: data/commands.json, next to the market snapshot. Override it with
//? COMMANDS_MANIFEST_PATH.
const target = path.resolve(
    process.env.COMMANDS_MANIFEST_PATH ?? "data/commands.json",
);
const manifest = buildManifest(
    commandCategories,
    slashCmds.map((cmd) => cmd.data.toJSON()),
);
mkdirSync(path.dirname(target), { recursive: true });
writeFileSync(target, JSON.stringify(manifest, null, 2) + "\n", "utf8");
console.log(
    `✅ ${manifest.categories.reduce((n, c) => n + c.commands.length, 0)} comandos exportados a ${target}`,
);
process.exit(0);
