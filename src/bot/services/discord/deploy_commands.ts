import { REST, Routes } from "discord.js";

export type DeploySummary = { global: number; guild: number };

/**
 * Publishes the slash commands:
 *  - public commands globally, so they work in every server that adds Purrfit,
 *  - developer commands only in GUILD_ID (your own server).
 *
 * Overwriting the guild list also removes old guild copies of the public
 * commands, which would otherwise show up twice in that server.
 */
export async function deployCommands(env: {
    token: string;
    clientId: string;
    guildId?: string;
}): Promise<DeploySummary> {
    const { publicCmds, devCmds } = await import("../../syncer");
    const rest = new REST({ version: "10" }).setToken(env.token);

    const globalPayload = publicCmds.map((c) => c.data.toJSON());
    await rest.put(Routes.applicationCommands(env.clientId), {
        body: globalPayload,
    });

    let guildCount = 0;
    if (env.guildId) {
        const guildPayload = devCmds.map((c) => c.data.toJSON());
        await rest.put(
            Routes.applicationGuildCommands(env.clientId, env.guildId),
            { body: guildPayload },
        );
        guildCount = guildPayload.length;
    }
    return { global: globalPayload.length, guild: guildCount };
}

export function readDeployEnv() {
    const token = process.env.TOKEN;
    const clientId = process.env.CLIENT_ID;
    if (!token || !clientId)
        throw new Error(
            "TOKEN y CLIENT_ID son obligatorios para publicar comandos",
        );
    return { token, clientId, guildId: process.env.GUILD_ID || undefined };
}
