import type { PrefixCommand } from "../../framework/types";
import { cmd } from "../../framework/context";
import { sendSimpleEmbed } from "../../Helpers/simplified_embed_builder";
import { deleteUserData } from "../../services/database/repository/clients/delete_data";
import { logger } from "../../services/logger";

export const deleteMyDataCommand: PrefixCommand = {
    name: "delete_my_data",
    aliases: ["deletedata"],
    description: "Permanently delete all your Purrfit data in every server",
    args: [
        {
            name: "confirm",
            kind: "choice",
            choices: ["confirm"],
            optional: true,
            description:
                "Type confirm to delete your data. This cannot be undone.",
        },
    ],

    async execute(ctx) {
        const confirmed = ctx.args.stringOpt("confirm") !== null;
        if (!confirmed) {
            //? A warning, not an error: it stays in the channel so it can be read
            await sendSimpleEmbed(ctx, {
                title: "⚠️ This will delete your data",
                description:
                    "Your balances (wallet and bank) and crypto holdings will be permanently removed from **every** server. Nothing was deleted yet.",
                hint: `To confirm, type ${cmd(ctx, "delete_my_data confirm")}. This cannot be undone.`,
            });
            return;
        }
        const deleted = await deleteUserData(ctx.user.id);
        logger.info("Datos de usuario eliminados a pedido", {
            userId: ctx.user.id,
            ...deleted,
        });
        await sendSimpleEmbed(ctx, {
            title: "🗑️ Your data was deleted",
            description:
                "Your balances and crypto holdings were removed from every server.",
            hint: `An active ${cmd(ctx, "work")} cooldown stays until it expires.`,
            tone: "success",
            eph: true,
        });
    },
};
