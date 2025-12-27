module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: "module",
    project: ["./tsconfig.json"],
  },
  plugins: ["@typescript-eslint", "vitest"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:vitest/recommended",
    "prettier",
  ],
  env: {
    node: true,
    es2022: true,
  },
  rules: {
    "no-console": "warn",
    "@typescript-eslint/no-unused-vars": [
      "error",
      { varsIgnorePattern: "^_", argsIgnorePattern: "^_" },
    ],
    "@typescript-eslint/no-explicit-any": "off",
  },
  ignorePatterns: ["build/", "dist/", "node_modules/", "*.d.ts"],
};
