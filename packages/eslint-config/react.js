// @ts-check

import { tanstackConfig } from "@tanstack/eslint-config"
import pluginRouter from "@tanstack/eslint-plugin-router"
import importPlugin from "eslint-plugin-import-x"

/** ESLint config for React apps and packages (extends base + Router + import ordering). */
export default [
  ...tanstackConfig,
  ...pluginRouter.configs["flat/recommended"],
  {
    plugins: { import: importPlugin },
    rules: {
      "import/order": [
        "error",
        {
          groups: [
            "builtin",
            "external",
            "internal",
            ["parent", "sibling", "index"],
          ],
          pathGroups: [
            {
              pattern: "react",
              group: "external",
              position: "before",
            },
            {
              pattern: "@/**",
              group: "internal",
              position: "before",
            },
          ],
          pathGroupsExcludedImportTypes: ["react"],
          "newlines-between": "never",
        },
      ],
    },
  },
]
