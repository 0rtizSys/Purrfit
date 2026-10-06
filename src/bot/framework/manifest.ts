import { usageOf, formatArgs } from "./args";
import { DEFAULT_PREFIX } from "./prefix";
import type { CommandCategory } from "./types";

//?------------------------------------------------------------------
//? A JSON description of every command, written to `data/commands.json`
//? (`npm run export-commands`). The web backend serves it to the dashboard,
//? which shows the command list with each server's own prefix: `usage`
//? never includes the prefix.
//?------------------------------------------------------------------

export type ManifestEntry = {
    name: string;
    aliases: string[];
    description: string;
    /** Without the prefix: `transfer <user> <amount>`. */
    usage: string;
};

export type Manifest = {
    version: 1;
    generatedAt: string;
    defaultPrefix: string;
    categories: {
        id: string;
        title: string;
        commands: (ManifestEntry & {
            permission: "everyone" | "admin" | "owner";
            subcommands: ManifestEntry[];
        })[];
    }[];
    /** The commands that are still slash commands. */
    slash: { name: string; description: string }[];
};

export function buildManifest(
    categories: readonly CommandCategory[],
    slash: readonly { name: string; description: string }[],
    now: Date = new Date(),
): Manifest {
    return {
        version: 1,
        generatedAt: now.toISOString(),
        defaultPrefix: DEFAULT_PREFIX,
        categories: categories
            .map((category) => ({
                id: category.id,
                title: category.title,
                //? `owner` commands are for the bot's developer, not for the dashboard
                commands: category.commands
                    .filter((command) => command.permission !== "owner")
                    .map((command) => ({
                        name: command.name,
                        aliases: [...(command.aliases ?? [])],
                        description: command.description,
                        usage: usageOf(command),
                        permission: command.permission ?? "everyone",
                        subcommands: (command.subcommands ?? []).map((sub) => ({
                            name: sub.name,
                            aliases: [...(sub.aliases ?? [])],
                            description: sub.description,
                            usage: `${command.name} ${sub.name} ${formatArgs(sub.args)}`.trim(),
                        })),
                    })),
            }))
            //? A category with only owner commands would be an empty heading
            .filter((category) => category.commands.length > 0),
        slash: slash.map(({ name, description }) => ({ name, description })),
    };
}
