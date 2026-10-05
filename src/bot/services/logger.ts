/**
 * Small structured logger.
 *
 * Every line goes to stdout/stderr as `<ISO time> <LEVEL> <message> {json}`,
 * which is what Docker and most hosts (Render, Railway, Fly...) collect and keep.
 * Errors are additionally sent to a Discord webhook when ERROR_WEBHOOK_URL is set,
 * throttled so a crash loop cannot flood the channel or hit Discord rate limits.
 */

type Level = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<Level, number> = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40,
};

const WEBHOOK_MIN_INTERVAL_MS = 10_000;
let lastWebhookAt = 0;
let suppressedSinceLastWebhook = 0;

function minLevel(): Level {
    const env = (process.env.LOG_LEVEL ?? "info").toLowerCase();
    return env in LEVEL_ORDER ? (env as Level) : "info";
}

function serializeError(err: unknown): Record<string, unknown> {
    if (err instanceof Error) {
        return { name: err.name, message: err.message, stack: err.stack };
    }
    return { value: String(err) };
}

function serializeMeta(meta?: Record<string, unknown>): string {
    if (!meta || Object.keys(meta).length === 0) return "";
    const safe: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(meta)) {
        safe[key] = value instanceof Error ? serializeError(value) : value;
    }
    try {
        return " " + JSON.stringify(safe);
    } catch {
        return " [unserializable meta]";
    }
}

async function sendToWebhook(message: string, meta?: Record<string, unknown>) {
    const url = process.env.ERROR_WEBHOOK_URL;
    if (!url) return;

    const now = Date.now();
    if (now - lastWebhookAt < WEBHOOK_MIN_INTERVAL_MS) {
        suppressedSinceLastWebhook++;
        return;
    }
    lastWebhookAt = now;
    const suppressed = suppressedSinceLastWebhook;
    suppressedSinceLastWebhook = 0;

    const details = serializeMeta(meta).trim().slice(0, 1500);
    const content = [
        `🚨 **Purrfit error**: ${message}`.slice(0, 300),
        details ? "```json\n" + details + "\n```" : "",
        suppressed ? `_(${suppressed} more errors suppressed)_` : "",
    ]
        .filter(Boolean)
        .join("\n");

    try {
        await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            //? allowed_mentions empty: an error message must never ping anyone
            body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
            signal: AbortSignal.timeout(5_000),
        });
    } catch (webhookErr) {
        //! Never log through `logger.error` here, it would recurse
        console.error(
            `${new Date().toISOString()} ERROR No se pudo enviar el error al webhook`,
            webhookErr,
        );
    }
}

function write(level: Level, message: string, meta?: Record<string, unknown>) {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel()]) return;
    const line = `${new Date().toISOString()} ${level.toUpperCase()} ${message}${serializeMeta(meta)}`;
    if (level === "error" || level === "warn") console.error(line);
    else console.log(line);
}

export const logger = {
    debug: (message: string, meta?: Record<string, unknown>) =>
        write("debug", message, meta),
    info: (message: string, meta?: Record<string, unknown>) =>
        write("info", message, meta),
    warn: (message: string, meta?: Record<string, unknown>) =>
        write("warn", message, meta),
    error: (message: string, meta?: Record<string, unknown>) => {
        write("error", message, meta);
        void sendToWebhook(message, meta);
    },
};
