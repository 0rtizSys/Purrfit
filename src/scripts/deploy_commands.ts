import * as dotenv from "dotenv";
import {
    deployCommands,
    readDeployEnv,
} from "../bot/services/discord/deploy_commands";

dotenv.config({ quiet: true });

(async () => {
    try {
        const summary = await deployCommands(readDeployEnv());
        console.log(
            `✅ ${summary.global} comandos slash publicados globalmente (/help, /dashboard, /support).` +
                (summary.guildCleared
                    ? " Se quitaron los comandos antiguos de GUILD_ID."
                    : ""),
        );
    } catch (err) {
        console.error("❌ No se pudieron publicar los comandos:", err);
        process.exitCode = 1;
    }
})();
