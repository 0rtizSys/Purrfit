import { pool } from "../services/database/db";
import { setCdTime } from "../services/database/repository/servers/set_cd_time";

jest.mock("../services/database/db", () => ({
    pool: {
        connect: jest.fn(),
    },
}));

type MockClient = {
    query: jest.Mock;
    release: jest.Mock;
};

const connectMock = pool.connect as jest.Mock;

function createClient(): MockClient {
    return {
        query: jest.fn().mockResolvedValue({}),
        release: jest.fn(),
    };
}

describe("setCdTime", () => {
    const now = 1_700_000_000_000;

    beforeEach(() => {
        jest.resetAllMocks();
        jest.spyOn(Date, "now").mockReturnValue(now);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it.each([0, -1, 1.5])(
        "rejects invalid cooldown seconds: %s",
        async (seconds) => {
            await expect(setCdTime("guild-1", seconds)).rejects.toThrow(
                "Seconds must be a positive integer.",
            );
            expect(connectMock).not.toHaveBeenCalled();
        },
    );

    it("upserts the cooldown time and shortens longer active cooldowns", async () => {
        const client = createClient();
        connectMock.mockResolvedValue(client);

        const result = await setCdTime("guild-1", 60);

        expect(result).toBe(false);
        expect(client.query).toHaveBeenNthCalledWith(1, "BEGIN;");
        expect(client.query).toHaveBeenNthCalledWith(
            2,
            expect.stringContaining("INSERT INTO server_configurations"),
            ["guild-1", 60],
        );
        expect(client.query).toHaveBeenNthCalledWith(
            3,
            expect.stringContaining("UPDATE cooldowns_table"),
            ["guild-1", now + 60_000],
        );
        expect(client.query).toHaveBeenNthCalledWith(4, "COMMIT;");
        expect(client.release).toHaveBeenCalledTimes(1);
    });

    it("rolls back and returns true when a query fails", async () => {
        const client = createClient();
        const errorSpy = jest
            .spyOn(console, "error")
            .mockImplementation(() => undefined);

        client.query.mockImplementation(async (query: string) => {
            if (query === "BEGIN;" || query === "ROLLBACK;") {
                return {};
            }
            throw new Error("query failed");
        });
        connectMock.mockResolvedValue(client);

        const result = await setCdTime("guild-1", 60);

        expect(result).toBe(true);
        expect(client.query).toHaveBeenCalledWith("ROLLBACK;");
        expect(client.query).not.toHaveBeenCalledWith("COMMIT;");
        expect(client.release).toHaveBeenCalledTimes(1);
        expect(errorSpy).toHaveBeenCalled();
    });

    it("returns true when acquiring a database client fails", async () => {
        const errorSpy = jest
            .spyOn(console, "error")
            .mockImplementation(() => undefined);
        connectMock.mockRejectedValue(new Error("connection failed"));

        const result = await setCdTime("guild-1", 60);

        expect(result).toBe(true);
        expect(errorSpy).toHaveBeenCalled();
    });
});
