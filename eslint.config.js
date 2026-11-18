import js from "@eslint/js";
import tseslint from "typescript-eslint";
import hooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  { ignores: ["dist/**", "dist-public/**", "build-service/**", "supabase/functions/notion-sync/dist/**", "release/**", "research/**", "node_modules/**", "src/components/ui/**", "playwright-report/**", "test-results/**"] },
  { files: ["supabase/functions/notion-sync/index.ts"],languageOptions: { globals: { Deno: "readonly" } } },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ["src/**/*.{ts,tsx}"], plugins: { "react-hooks": hooks }, rules: { ...hooks.configs.recommended.rules } },
  { languageOptions: { globals: { console: "readonly", process: "readonly", Buffer: "readonly", URL: "readonly", fetch: "readonly", AbortSignal: "readonly", setTimeout: "readonly", clearTimeout: "readonly" } } },
);
