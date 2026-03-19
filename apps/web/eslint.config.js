//  @ts-check

import config from "@workspace/eslint-config/react"

export default [
  { ignores: ["eslint.config.js", "prettier.config.js", ".output/**"] },
  ...config,
]
