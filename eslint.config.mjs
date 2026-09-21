/**
 * Part of Auto-Delete Cookies for Privacy, a fork of Cookie AutoDelete.
 * Copyright (c) 2017-2022 Kenny Do and CAD Team; fork changes (c) 2026 j127.
 * Licensed under MIT (see LICENSE).
 */
import eslintReact from "@eslint-react/eslint-plugin";
import eslint from "@eslint/js";
import prettier from "eslint-config-prettier";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      // Claude Code worktrees live under .claude/worktrees/ and carry their
      // own built extension/bundles/; the root-anchored ignores below do not
      // match those nested copies, so ignore the whole directory.
      ".claude/",
      "extension/bundles/",
      "extension/global_files/",
      "builds/",
      "coverage/",
      "node_modules/",
      // mdBook: vendored mermaid assets + generated book output.
      "documentation/",
    ],
  },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  eslintReact.configs["recommended-typescript"],
  prettier,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.jest,
        ...globals.webextensions,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "no-console": "warn",
    },
  },
  {
    // The build script talks to a human on stdout by design.
    files: ["scripts/**"],
    rules: {
      "no-console": "off",
    },
  }
);
