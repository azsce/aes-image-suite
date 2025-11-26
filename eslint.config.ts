import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import sonarjs from "eslint-plugin-sonarjs";
import cspellESLintPluginRecommended from "@cspell/eslint-plugin/recommended";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";

export default [
  {
    ignores: [
      // Directories (without trailing slash for ESLint 9)
      "node_modules",
      ".next",
      "logs",
      "storage",
      ".cursor",
      "build",
      "dist",
      "out",
      ".scannerwork",
      "docs",
      ".git",
      ".kiro",
      ".vscode",
      ".devcontainer",
      ".github",
      ".ai",
      // File patterns
      "**/*.d.ts",
      "next-env.d.ts",
      "eslint.config.ts",
      "debug-eslint.js",
      "bun.lock",
      "*.lock",
      "*.log",
    ],
  },
  eslint.configs.recommended,
  sonarjs.configs.recommended,
  cspellESLintPluginRecommended,

  // TypeScript and React-specific configuration
  ...tseslint.configs.strictTypeChecked.map(config => ({
    ...config,
    files: ["**/*.{ts,tsx}"],
  })),

  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        project: ["./tsconfig.app.json", "./tsconfig.node.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // React rules
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],

      // TypeScript rules
      // Note: you must disable the base rule as it can report incorrect errors
      "no-throw-literal": "off",
      "@typescript-eslint/only-throw-error": "off",

      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-namespace": "off",

      /**
       * Bans the `!` (non-null assertion) operator.
       * This is the #1 source of your runtime null errors.
       */
      "@typescript-eslint/no-non-null-assertion": "error",

      /**
       * Bans the `any` keyword, forcing you to use the safer `unknown`.
       * `any` disables all null checking.
       */
      "@typescript-eslint/no-explicit-any": "error",

      /**
       * Disallow direct use of console methods.
       * Use the logger utility instead: import { logger } from '@/utils/logger'
       */
      "no-console": "error",

      // Spell checking
      "@cspell/spellchecker": [
        "warn",
        {
          autoFix: true,
          configFile: new URL("./cspell.config.yaml", import.meta.url).toString(),
          cspellOptionsRoot: import.meta.url,
        },
      ],
    },
  },

  // Allow console in logger implementation and vite config
  {
    files: ["src/utils/logger/**/*.ts", "vite.config.ts"],
    rules: {
      "no-console": "off",
      "sonarjs/no-nested-functions": "off",
      "@typescript-eslint/no-unnecessary-condition": "off",
    },
  },
];
