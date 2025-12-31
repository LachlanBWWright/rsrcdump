import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(
  [
    eslint.configs.recommended,
    tseslint.configs.strict,
    tseslint.configs.stylistic,
  ],
  {
    plugins: {
      "typescript-eslint": tseslint,
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
    rules: {
      "@typescript-eslint/no-unsafe-type-assertion": "error",
    },
  },
);
