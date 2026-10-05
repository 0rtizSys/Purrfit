import config from "./embed_configs.json";

//* Embed palette: every embed color comes from here (see ui/theme.ts)

type PaletteKey = keyof typeof config.palette;

export const palette = Object.fromEntries(
    Object.entries(config.palette).map(([key, hex]) => [key, parseInt(hex)]),
) as Record<PaletteKey, number>;
