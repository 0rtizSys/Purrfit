import { sendSimpleEmbed } from "../../Helpers/simplified_embed_builder";
import type { PrefixCommand } from "../../framework/types";

export const pingCommand: PrefixCommand = {
    name: "ping",
    description: "Check the bot latency",

    async execute(ctx) {
        //? How long the bot took to see the message (Discord's clock vs ours)
        const bot = Math.max(Date.now() - ctx.message.createdTimestamp, 0);
        const api = ctx.client.ws.ping;

        await sendSimpleEmbed(ctx, {
            title: "🏓 Pong!",
            fields: [
                { name: "📶 Bot", value: `\`${bot}ms\``, inline: true },
                //? ws.ping is -1 until the first heartbeat after login
                {
                    name: "🛜 Discord API",
                    value: api >= 0 ? `\`${api}ms\`` : "`measuring…`",
                    inline: true,
                },
            ],
        });
    },
};
