import type { PrefixCommand, PrefixSubcommand } from "./types";

//? A name or alias, lowercase, typed right after the prefix
const NAME = /^[a-z][a-z0-9_]{0,31}$/;

export type Registry = {
    readonly commands: readonly PrefixCommand[];
    /** Finds a command by its name or any alias (case-insensitive). */
    find(token: string): PrefixCommand | undefined;
};

export function findSubcommand(
    command: PrefixCommand,
    token: string | undefined,
): PrefixSubcommand | undefined {
    if (!token) return undefined;
    const wanted = token.toLowerCase();
    return command.subcommands?.find(
        (sub) => sub.name === wanted || sub.aliases?.includes(wanted),
    );
}

/**
 * Indexes the commands by name and alias. It throws (at startup, not in front
 * of a user) when two commands answer to the same word or a definition is
 * malformed.
 */
export function buildRegistry(commands: readonly PrefixCommand[]): Registry {
    const byWord = new Map<string, PrefixCommand>();
    for (const command of commands) {
        const hasSubs = Boolean(command.subcommands?.length);
        if (hasSubs === Boolean(command.execute))
            throw new Error(
                `Command "${command.name}" needs either \`execute\` or \`subcommands\`, not ${hasSubs ? "both" : "neither"}`,
            );
        if (hasSubs && command.args?.length)
            throw new Error(
                `Command "${command.name}" has subcommands, so its arguments belong to each subcommand`,
            );
        for (const word of [command.name, ...(command.aliases ?? [])]) {
            if (!NAME.test(word))
                throw new Error(`Invalid command word "${word}"`);
            const taken = byWord.get(word);
            if (taken)
                throw new Error(
                    `"${word}" is used by both "${taken.name}" and "${command.name}"`,
                );
            byWord.set(word, command);
        }
        const subWords = new Set<string>();
        for (const sub of command.subcommands ?? []) {
            for (const word of [sub.name, ...(sub.aliases ?? [])]) {
                if (!NAME.test(word) || subWords.has(word))
                    throw new Error(
                        `Invalid or repeated subcommand word "${word}" in "${command.name}"`,
                    );
                subWords.add(word);
            }
        }
    }
    return {
        commands,
        find: (token) => byWord.get(token.toLowerCase()),
    };
}
