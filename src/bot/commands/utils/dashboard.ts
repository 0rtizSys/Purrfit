import { linkCommand } from "./link_command";

export const dashboardCommand = linkCommand({
    name: "dashboard",
    description: "Open the web dashboard to manage Purrfit",
    env: "DASHBOARD_URL",
    title: "Purrfit dashboard",
    text: "Change the prefix and the economy rules of your servers and watch the crypto market with live candlestick charts.",
    button: "Open dashboard",
    missing: "The dashboard link is not configured yet.",
});
