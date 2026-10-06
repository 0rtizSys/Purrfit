import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";

export default defineConfig([
  //? Third-party bundle, vendored as is (see THIRD_PARTY_NOTICES.md)
  { ignores: ["src/web/js/lightweight-charts.js"] },
  { files: ["**/*.{js,mjs,cjs,ts,mts,cts}"], languageOptions: { globals: globals.browser } },
  tseslint.configs.recommended,
]);
