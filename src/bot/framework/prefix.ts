//? The rules for a server's command prefix. The same rule is enforced by the
//? database (migration 004) and by the web backend, so the three always agree.

export const DEFAULT_PREFIX = "$>";
export const MAX_PREFIX_LENGTH = 5;

//? Whitespace would make `prefix command` ambiguous, a backtick or backslash
//? breaks the formatting of every message that shows the prefix, and `@`/`#`
//? could turn a mention or a channel reference into a trigger.
const FORBIDDEN = /[\s`\\@#]/u;

export type PrefixCheck =
    | { ok: true; prefix: string }
    | { ok: false; reason: string };

export function checkPrefix(input: string): PrefixCheck {
    const prefix = input.trim();
    //? Counted in characters (code points), like the database does
    const length = [...prefix].length;
    if (length < 1) return { ok: false, reason: "The prefix can't be empty." };
    if (length > MAX_PREFIX_LENGTH)
        return {
            ok: false,
            reason: `The prefix can have at most ${MAX_PREFIX_LENGTH} characters.`,
        };
    if (FORBIDDEN.test(prefix))
        return {
            ok: false,
            reason: "The prefix can't contain spaces, backticks, `\\`, `@` or `#`.",
        };
    return { ok: true, prefix };
}
