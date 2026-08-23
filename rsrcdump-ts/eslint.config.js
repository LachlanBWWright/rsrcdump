import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import neverthrow from "eslint-plugin-neverthrow";
import tseslint from "typescript-eslint";

// eslint-plugin-neverthrow still uses the ESLint 8 RuleContext API. Adapt its
// single rule to ESLint 9 while retaining type-aware parser services.
const neverthrowRule = neverthrow.rules["must-use-result"];
const eslint9Neverthrow = {
  rules: {
    "must-use-result": {
      ...neverthrowRule,
      create(context) {
        let currentNode;
        const compatibleContext = new Proxy(context, {
          get(target, property, receiver) {
            if (property === "parserServices") {
              return target.sourceCode.parserServices;
            }
            if (property === "getScope") {
              return () => target.sourceCode.getScope(currentNode);
            }
            return Reflect.get(target, property, receiver);
          },
        });
        const listeners = neverthrowRule.create(compatibleContext);

        return Object.fromEntries(
          Object.entries(listeners).map(([selector, listener]) => [
            selector,
            (node) => {
              currentNode = node;
              return listener(node);
            },
          ]),
        );
      },
    },
  },
};

export default defineConfig(
  [
    {
      ignores: [
        "node_modules/**",
        "build/**",
        "dist/**",
        "coverage/**",
        "**/*.d.ts",
        "vitest.config.ts",
        "examples/**",
        "bin/**",
        "scripts/**",
        "eslint.config.js",
      ],
    },
    eslint.configs.recommended,
    tseslint.configs.strictTypeChecked,
    tseslint.configs.stylisticTypeChecked,
  ],
  {
    plugins: {
      neverthrow: eslint9Neverthrow,
    },
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
    rules: {
      "neverthrow/must-use-result": "error",
      // This library intentionally supports dynamic JSON/resource data and
      // generic Result error types. Keep the strict presets, with narrowly
      // documented exceptions where their assumptions do not fit the API.
      "@typescript-eslint/no-base-to-string": "off",
      "@typescript-eslint/no-deprecated": "off",
      "@typescript-eslint/no-unnecessary-condition": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-type-assertion": "error",
      "@typescript-eslint/only-throw-error": "off",
      "@typescript-eslint/prefer-nullish-coalescing": "off",
      "@typescript-eslint/restrict-template-expressions": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: ["**/*.test.ts"],
    rules: {
      "@typescript-eslint/await-thenable": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unnecessary-condition": "off",
      "@typescript-eslint/prefer-nullish-coalescing": "off",
      "@typescript-eslint/prefer-optional-chain": "off",
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/restrict-template-expressions": "off",
    },
  },
);
