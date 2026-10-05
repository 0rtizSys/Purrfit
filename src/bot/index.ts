import {
    Client,
    GatewayIntentBits,
    Events,
    MessageFlags,
    ActivityType,
    Interaction,
} from "discord.js";
import * as dotenv from "dotenv";
import { cmds } from "./syncer";
import { logger } from "./services/logger";
import { RateLimiter } from "./services/rate_limit";
import { Scheduler } from "./services/jobs/scheduler";
import { pool } from "./services/database/db";

dotenv.config({ quiet: true });

//? Slash commands only need the Guilds intent (no message content)
const client = new Client({
    intents: [GatewayIntentBits.Guilds],
});

const rateLimiter = new RateLimiter();
const sweepTimer = setInterval(() => rateLimiter.sweep(), 60_000);
sweepTimer.unref();

const scheduler = new Scheduler();

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

    if (process.env.DISABLE_JOBS !== "true") scheduler.start();
});

client.on(Events.GuildCreate, (guild) => {
    logger.info("Agregado a un servidor", {
        guildId: guild.id,
        members: guild.memberCount,
    });
});

client.on(Events.GuildDelete, (guild) => {
    logger.info("Eliminado de un servidor", { guildId: guild.id });
});

client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    if (!interaction.isChatInputCommand()) return;
    const command = cmds.find(
        (cmd) => cmd.data!.name === interaction.commandName,
    );
    if (!command) {
        logger.warn(`Comando no encontrado: ${interaction.commandName}`);
        return;
    }

    const limit = rateLimiter.check(
        interaction.user.id,
        interaction.commandName,
    );
    if (!limit.allowed) {
        await interaction
            .reply({
                content: `⏳ Slow down! Try again in ${Math.ceil(limit.retryAfterMs / 1000)}s.`,
                flags: MessageFlags.Ephemeral,
            })
            .catch(() => undefined);
        return;
    }

    try {
        await command.execute!(interaction);
    } catch (error) {
        logger.error(`Error ejecutando /${interaction.commandName}`, {
            error,
            guildId: interaction.guildId,
        });
        //? The error reply itself can fail (expired or already answered
        //? interaction); that must never escape this handler
        try {
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({
                    content: "❌ Error ejecutando comando",
                    flags: MessageFlags.Ephemeral,
                });
            } else {
                await interaction.reply({
                    content: "❌ Error ejecutando comando",
                    flags: MessageFlags.Ephemeral,
                });
            }
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
client.login(process.env.TOKEN).catch((error) => {
    logger.error("No se pudo iniciar sesión en Discord", { error });
    process.exit(1);
});
