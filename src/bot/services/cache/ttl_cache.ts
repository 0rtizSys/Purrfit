/**
 * Minimal in-memory cache with per-entry expiration.
 * Used for per-guild settings that are read on almost every command.
 */
export class TtlCache<V> {
    private readonly entries = new Map<
        string,
        { value: V; expiresAt: number }
    >();

    constructor(private readonly ttlMs: number) {}

    get(key: string): V | undefined {
        const entry = this.entries.get(key);
        if (!entry) return undefined;
        if (entry.expiresAt <= Date.now()) {
            this.entries.delete(key);
            return undefined;
        }
        return entry.value;
    }

    set(key: string, value: V): void {
        this.entries.set(key, { value, expiresAt: Date.now() + this.ttlMs });
    }

    delete(key: string): void {
        this.entries.delete(key);
    }

    clear(): void {
        this.entries.clear();
    }
}
