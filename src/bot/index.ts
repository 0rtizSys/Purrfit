import {
    Client,
    GatewayIntentBits,
    Events,
    ActivityType,
    Interaction,
} from "discord.js";
import * as dotenv from "dotenv";
import { registry, slashCmds } from "./syncer";
import { logger } from "./services/logger";
import { RateLimiter } from "./services/rate_limit";
import { Scheduler } from "./services/jobs/scheduler";
import { Heartbeat } from "./services/heartbeat";
import { pool } from "./services/database/db";
import {
    internalErrorEmbed,
    sendSimpleEmbed,
} from "./Helpers/simplified_embed_builder";
import { Emoji } from "./ui/theme";
import { relativeTime } from "./ui/format";
import { handleMessage } from "./framework/dispatcher";
import { slashReplier } from "./framework/context";
import { DEFAULT_PREFIX } from "./framework/prefix";
import { getPrefix } from "./services/database/repository/servers/prefix";
import {
    recordGuild,
    recordGuildLeft,
    syncGuilds,
} from "./services/database/repository/servers/bot_guilds";

dotenv.config({ quiet: true });

//? Commands are typed in chat (`$>work`), so the bot reads message text.
//? MessageContent is a privileged intent: enable it in the Developer Portal
//? (Bot > Privileged Gateway Intents). Only messages that start with the
//? server's prefix are looked at, and their text is never stored.
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

const rateLimiter = new RateLimiter();
const sweepTimer = setInterval(() => rateLimiter.sweep(), 60_000);
sweepTimer.unref();

const scheduler = new Scheduler();
const heartbeat = new Heartbeat(client);

client.once(Events.ClientReady, (ready) => {
    logger.info(`Bot listo como ${ready.user.tag}`, {
        guilds: ready.guilds.cache.size,
    });

    ready.user.setPresence({
        activities: [
            { name: "the crypto markets 📈", type: ActivityType.Watching },
        ],
        status: "online",
    });

    //? The web dashboard reads this list to know where Purrfit is
    void syncGuilds(ready.guilds.cache.values());

    if (process.env.DISABLE_JOBS !== "true") scheduler.start();
    heartbeat.markRunning();
});

client.on(Events.GuildCreate, (guild) => {
    heartbeat.noteEvent("guild_join");
    void recordGuild(guild);
    logger.info("Agregado a un servidor", {
        guildId: guild.id,
        members: guild.memberCount,
    });
});

client.on(Events.GuildUpdate, (_before, guild) => {
    void recordGuild(guild);
});

client.on(Events.GuildDelete, (guild) => {
    heartbeat.noteEvent("guild_leave");
    void recordGuildLeft(guild.id);
    logger.info("Eliminado de un servidor", { guildId: guild.id });
});

client.on(Events.MessageCreate, (message) => {
    void handleMessage(message, {
        registry,
        getPrefix,
        rateLimiter,
        ownerId: process.env.OWNER_ID,
        onCommand: () => heartbeat.noteEvent("command"),
    });
});

//? Only /help, /dashboard and /support are slash commands
client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    if (!interaction.isChatInputCommand()) return;
    const command = slashCmds.find(
        (cmd) => cmd.data.name === interaction.commandName,
    );
    if (!command) {
        logger.warn(`Comando no encontrado: ${interaction.commandName}`);
        return;
    }

    const replier = slashReplier(interaction, DEFAULT_PREFIX);
    const limit = rateLimiter.check(
        interaction.user.id,
        interaction.commandName,
    );
    if (!limit.allowed) {
        await sendSimpleEmbed(replier, {
            title: `${Emoji.cooldown} Slow down`,
            description: `You're using commands too fast. Try again ${relativeTime(Date.now() + limit.retryAfterMs)}.`,
            tone: "cooldown",
        }).catch(() => undefined);
        return;
    }

    heartbeat.noteEvent("command");
    try {
        await command.execute(interaction);
    } catch (error) {
        logger.error(`Error ejecutando /${interaction.commandName}`, {
            error,
            guildId: interaction.guildId,
        });
        //? The error reply itself can fail (expired or already answered
        //? interaction); that must never escape this handler
        try {
            await internalErrorEmbed(replier);
        } catch (replyError) {
            logger.warn("No se pudo responder al error", { error: replyError });
        }
    }
});

client.on(Events.Error, (error) => {
    logger.error("Error del cliente de Discord", { error });
});

//! Node terminates the process on unhandled promise rejections; a single
//! failed Discord reply must not take the whole bot offline
process.on("unhandledRejection", (reason) => {
    logger.error("Promesa rechazada sin manejar", { error: reason });
});

//? Docker/hosts send SIGTERM on deploy: finish running jobs, close the
//? Discord connection and the DB pool, then exit
let shuttingDown = false;
async function shutdown(signal: string) {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`Apagando (${signal})...`);
    const force = setTimeout(() => process.exit(1), 10_000);
    force.unref();
    try {
        await scheduler.stop();
        await heartbeat.stop();
        await client.destroy();
        await pool.end();
    } catch (error) {
        logger.error("Error durante el apagado", { error });
    }
    process.exit(0);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

if (!process.env.TOKEN) {
    logger.error("Falta la variable TOKEN");
    process.exit(1);
}
heartbeat.start();
client.login(process.env.TOKEN).catch((error) => {
    logger.error("No se pudo iniciar sesión en Discord", { error });
    process.exit(1);
});
