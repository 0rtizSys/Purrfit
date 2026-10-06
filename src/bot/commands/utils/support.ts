import { linkCommand } from "./link_command";

export const supportCommand = linkCommand({
    name: "support",
    description: "Join the Purrfit support server",
    env: "SUPPORT_URL",
    title: "Support server",
    text: "Questions, bugs or ideas? Come say hi.",
    button: "Join the support server",
    missing: "The support server link is not configured yet.",
});
