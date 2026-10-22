#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
node -e 'if (Number(process.versions.node.split(".")[0]) < 24) { console.error("HORUS requiere Node.js 24 o superior."); process.exit(1); }'
npm ci --cache "${npm_config_cache:-.local/npm-cache}" --no-fund --no-audit
npm run build
