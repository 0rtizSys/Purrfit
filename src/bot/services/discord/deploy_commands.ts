import { REST, Routes } from "discord.js";

export type DeploySummary = {
    /** Slash commands published globally. */
    global: number;
    /** True when GUILD_ID was set and its old slash commands were removed. */
    guildCleared: boolean;
};

/**
 * Publishes the slash commands (/help, /dashboard, /support) globally, so they
 * work in every server that adds Purrfit. Every other command is typed in
 * chat with the server's prefix and needs no deployment.
 *
 * With GUILD_ID set it also empties that server's slash list: before v3.0.0
 * the developer commands (and old copies of the public ones) lived there and
 * would otherwise keep showing up, doing nothing.
 */
export async function deployCommands(env: {
    token: string;
    clientId: string;
    guildId?: string;
}): Promise<DeploySummary> {
    const { slashCmds } = await import("../../syncer");
    const rest = new REST({ version: "10" }).setToken(env.token);

    //? PUT replaces the whole list, which also removes every command of v2
    const globalPayload = slashCmds.map((c) => c.data.toJSON());
    await rest.put(Routes.applicationCommands(env.clientId), {
        body: globalPayload,
    });

    if (env.guildId) {
        await rest.put(
            Routes.applicationGuildCommands(env.clientId, env.guildId),
            { body: [] },
        );
    }
    return { global: globalPayload.length, guildCleared: Boolean(env.guildId) };
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
