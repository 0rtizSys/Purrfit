import { collectHeartbeat } from "../services/heartbeat";

function fakeClient(opts: {
    ready: boolean;
    ping: number;
    guilds: { memberCount?: number }[];
}) {
    return {
        isReady: () => opts.ready,
        ws: { ping: opts.ping },
        guilds: {
            cache: {
                size: opts.guilds.length,
                values: () => opts.guilds.values(),
            },
        },
    } as unknown as Parameters<typeof collectHeartbeat>[0];
}

describe("collectHeartbeat", () => {
    it("reports ping, guilds, users and memory", () => {
        const row = collectHeartbeat(
            fakeClient({
                ready: true,
                ping: 41.6,
                guilds: [{ memberCount: 10 }, { memberCount: 5 }, {}],
            }),
            "running",
            200 * 1024 * 1024,
        );
        expect(row).toEqual({
            status: "running",
            discordReady: true,
            pingMs: 42,
            guilds: 3,
            users: 15,
            rssMb: 200,
        });
    });

    it("turns the -1 ping of a not-yet-connected client into null", () => {
        const row = collectHeartbeat(
            fakeClient({ ready: false, ping: -1, guilds: [] }),
            "starting",
        );
        expect(row.pingMs).toBeNull();
        expect(row.discordReady).toBe(false);
        expect(row.guilds).toBe(0);
    });
});
