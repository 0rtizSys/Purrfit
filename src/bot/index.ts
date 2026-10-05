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

dotenv.config();

const client = new Client({
    intents: [GatewayIntentBits.GuildMessages, GatewayIntentBits.Guilds],
});

client.once(Events.ClientReady, () => {
    console.log(`Bot listo como ${client.user?.tag}`);

    client.user?.setPresence({
        activities: [
            {
                name: "Crypto Markets 📈",
                type: ActivityType.Streaming,
                url: "https://www.twitch.tv/k1m6a",
            },
        ],
        status: "online",
    });
});

client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    if (!interaction.isChatInputCommand()) return;
    const command = cmds.find(
        (cmd) => cmd.data!.name === interaction.commandName,
    );
    if (!command) {
        console.error(`❌ Comando no encontrado: ${interaction.commandName}`);
        return;
    }
    try {
        await command.execute!(interaction);
    } catch (error) {
        console.error(error);
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
            console.error("No se pudo responder al error:", replyError);
        }
    }
});

client.on(Events.Error, (error) => {
    console.error("Error del cliente de Discord:", error);
});

//! Node terminates the process on unhandled promise rejections; a single
//! failed Discord reply must not take the whole bot offline
process.on("unhandledRejection", (reason) => {
    console.error("Promesa rechazada sin manejar:", reason);
});

client.login(process.env.TOKEN);
