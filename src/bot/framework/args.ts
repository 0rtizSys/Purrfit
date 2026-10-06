import type { User } from "discord.js";
import type { ArgSpec, PrefixCommand, PrefixSubcommand } from "./types";

//?------------------------------------------------------------------
//? Turns the words after a command into typed values. A command declares
//? its arguments (`ArgSpec`), the parser checks them, and `execute` reads
//? them with `ctx.args.user("target")`, `ctx.args.integer("amount")`...
//?------------------------------------------------------------------

/** What the parser needs from Discord: turning an id into a user. */
export type ArgResolver = {
    resolveUser(id: string): Promise<User | null>;
};

/** The values of a parsed command. A name the command did not declare throws. */
export class ParsedArgs {
    constructor(
        private readonly values: ReadonlyMap<string, unknown> = new Map(),
    ) {}

    has(name: string): boolean {
        return this.values.has(name);
    }

    private need<T>(name: string): T {
        if (!this.values.has(name))
            throw new Error(`Argument "${name}" was not provided`);
        return this.values.get(name) as T;
    }

    private maybe<T>(name: string): T | null {
        return this.values.has(name) ? (this.values.get(name) as T) : null;
    }

    user(name: string): User {
        return this.need<User>(name);
    }
    userOpt(name: string): User | null {
        return this.maybe<User>(name);
    }
    /** `integer` and `amount` arguments. */
    integer(name: string): number {
        return this.need<number>(name);
    }
    integerOpt(name: string): number | null {
        return this.maybe<number>(name);
    }
    number(name: string): number {
        return this.need<number>(name);
    }
    numberOpt(name: string): number | null {
        return this.maybe<number>(name);
    }
    /** `word`, `text` and `choice` arguments. */
    string(name: string): string {
        return this.need<string>(name);
    }
    stringOpt(name: string): string | null {
        return this.maybe<string>(name);
    }
}

export type ParseResult =
    | { ok: true; args: ParsedArgs }
    | { ok: false; error: string };

const USER_TOKEN = /^(?:<@!?(\d{15,25})>|(\d{15,25}))$/;
const MULTIPLIER: Record<string, number> = { k: 1e3, m: 1e6, b: 1e9 };

const fail = (error: string): { ok: false; error: string } => ({
    ok: false,
    error,
});

const fmt = (n: number) => n.toLocaleString("en-US");

function checkRange(
    spec: ArgSpec,
    value: number,
): { ok: false; error: string } | null {
    const { min, max } = spec;
    if (
        (min !== undefined && value < min) ||
        (max !== undefined && value > max)
    ) {
        const range =
            min !== undefined && max !== undefined
                ? `between \`${fmt(min)}\` and \`${fmt(max)}\``
                : min !== undefined
                  ? `at least \`${fmt(min)}\``
                  : `at most \`${fmt(max!)}\``;
        return fail(`\`${spec.name}\` must be ${range}.`);
    }
    return null;
}

async function parseToken(
    spec: ArgSpec,
    token: string,
    resolver: ArgResolver,
): Promise<{ ok: true; value: unknown } | { ok: false; error: string }> {
    switch (spec.kind) {
        case "user": {
            const match = USER_TOKEN.exec(token);
            if (!match)
                return fail(
                    `\`${spec.name}\` must be a mention (@user) or a user id.`,
                );
            const user = await resolver.resolveUser(match[1] ?? match[2]!);
            if (!user) return fail("I couldn't find that user.");
            return { ok: true, value: user };
        }
        case "integer":
        case "amount": {
            const clean = token.toLowerCase().replace(/[,_]/g, "");
            const pattern =
                spec.kind === "amount"
                    ? /^(\d+(?:\.\d+)?)([kmb])?$/
                    : /^([+-]?\d+)()$/;
            const match = pattern.exec(clean);
            if (!match)
                return fail(
                    spec.kind === "amount"
                        ? `\`${spec.name}\` must be a whole number (\`1500\`, \`1.5k\`, \`2m\`).`
                        : `\`${spec.name}\` must be a whole number.`,
                );
            //? toFixed removes float noise: 1.1k is 1100, not 1100.0000000000002
            const value = Number(
                (Number(match[1]) * (MULTIPLIER[match[2] ?? ""] ?? 1)).toFixed(
                    6,
                ),
            );
            if (!Number.isSafeInteger(value))
                return fail(`\`${spec.name}\` must be a whole number.`);
            return checkRange(spec, value) ?? { ok: true, value };
        }
        case "number": {
            const clean = token.replace(",", ".").replace(/%$/, "");
            if (!/^[+-]?\d+(?:\.\d+)?$/.test(clean))
                return fail(
                    `\`${spec.name}\` must be a number (like \`2.5\`).`,
                );
            const value = Number(clean);
            if (!Number.isFinite(value))
                return fail(
                    `\`${spec.name}\` must be a number (like \`2.5\`).`,
                );
            return checkRange(spec, value) ?? { ok: true, value };
        }
        case "choice": {
            const found = spec.choices?.find(
                (choice) => choice.toLowerCase() === token.toLowerCase(),
            );
            if (!found)
                return fail(
                    `\`${spec.name}\` must be one of: ${(spec.choices ?? []).map((c) => `\`${c}\``).join(", ")}.`,
                );
            return { ok: true, value: found };
        }
        case "word":
        case "text":
            return { ok: true, value: token };
    }
}

/**
 * Parses `tokens` against `specs`. Extra tokens are an error on purpose:
 * `$>transfer @a 1 000` must not silently send 1.
 */
export async function parseArgs(
    specs: readonly ArgSpec[],
    tokens: readonly string[],
    resolver: ArgResolver,
): Promise<ParseResult> {
    const values = new Map<string, unknown>();
    let index = 0;
    for (const spec of specs) {
        if (index >= tokens.length) {
            if (spec.optional) continue;
            return fail(`Missing \`${spec.name}\`.`);
        }
        if (spec.kind === "text") {
            values.set(spec.name, tokens.slice(index).join(" "));
            index = tokens.length;
            continue;
        }
        const parsed = await parseToken(spec, tokens[index]!, resolver);
        if (!parsed.ok) return parsed;
        values.set(spec.name, parsed.value);
        index++;
    }
    if (index < tokens.length) {
        const extra = tokens.slice(index).join(" ");
        return fail(
            `Unexpected extra input: \`${extra.length > 40 ? `${extra.slice(0, 40)}…` : extra}\`.`,
        );
    }
    return { ok: true, args: new ParsedArgs(values) };
}

/** `<user> <amount> [note…]`: the arguments as the help shows them. */
export function formatArgs(specs: readonly ArgSpec[] = []): string {
    return specs
        .map((spec) => {
            const label =
                spec.kind === "choice"
                    ? (spec.choices ?? []).join("|")
                    : spec.kind === "text"
                      ? `${spec.name}…`
                      : spec.name;
            return spec.optional ? `[${label}]` : `<${label}>`;
        })
        .join(" ");
}

/**
 * `transfer <user> <amount>`, `crypto buy <coin> <amount>` or, for a group
 * without a chosen subcommand, `crypto <market|chart|buy|sell|portfolio>`.
 * Always without the prefix.
 */
export function usageOf(
    command: PrefixCommand,
    sub?: PrefixSubcommand | null,
): string {
    const parts = [command.name];
    if (sub) {
        parts.push(sub.name, formatArgs(sub.args));
    } else if (command.subcommands?.length) {
        parts.push(`<${command.subcommands.map((s) => s.name).join("|")}>`);
    } else {
        parts.push(formatArgs(command.args));
    }
    return parts.filter(Boolean).join(" ");
}
