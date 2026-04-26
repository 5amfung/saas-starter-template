#!/usr/bin/env sh
set -eu

if [ "${CI:-}" = "true" ] || [ ! -f ".env.local" ]; then
  exec node --import ./.output/server/instrument.server.mjs ./.output/server/index.mjs
fi

exec node --env-file=.env.local --import ./.output/server/instrument.server.mjs ./.output/server/index.mjs
