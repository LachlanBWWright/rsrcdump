/**
 * Flat ESLint config (eslint.config.cjs)
 * Based on https://eslint.org/docs/latest/use/configure/configuration-files
 */

const { defineConfig } = require("eslint-define-config");

module.exports = defineConfig([
  // files to ignore
  {
    ignores: ["build/**", "dist/**", "node_modules/**", "*.d.ts"],
  },

  // Base rules for JS and general project
  {
    files: ["**/*.js", "**/*.cjs", "**/*.mjs", "**/*.ts", "**/*.tsx"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
    plugins: {
      vitest: require("eslint-plugin-vitest"),
      import: require("eslint-plugin-import"),
    },
    rules: {
      "no-console": "warn",
      "import/order": [
        "error",
        {
          groups: ["builtin", "external", "internal", "parent", "sibling", "index", "object"],
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true }
        }
      ]
    },
    settings: {
      "import/parsers": {
        "@typescript-eslint/parser": [".ts", ".tsx"]
      },
      "import/resolver": {
        typescript: {
          alwaysTryTypes: true
        }
      }
    }
  },

  // TypeScript files (type-aware rules need parserOptions.project)
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: require("@typescript-eslint/parser"),
      parserOptions: {
        project: ["./tsconfig.json"],
        tsconfigRootDir: __dirname,
        warnOnUnsupportedTypeScriptVersion: false,
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": require("@typescript-eslint/eslint-plugin"),
    },
    extends: [
      "plugin:@typescript-eslint/recommended",
      "plugin:@typescript-eslint/recommended-requiring-type-checking",
    ],
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { varsIgnorePattern: "^_", argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }]
    }
  },

  // Test files (Vitest)
  {
    files: ["**/*.test.ts", "tests/**", "src/**/__tests__/**"],
    env: { vitest: true }
  },

  // Don't apply type-aware parsing to JS config files
  {
    files: ["*.cjs", "*.js"],
    languageOptions: {
      parserOptions: { project: null }
    }
  }
]);
