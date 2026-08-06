#!/usr/bin/env bash
# Preview the site locally at http://localhost:8765
#
# The page fetches JSON, so opening docs/index.html via file:// won't work — it needs a server.
# This runs tools/serve.py rather than plain http.server so the drop zone on the Homes tab can
# write dropped listing links into data/queue.json for Claude to pick up.
set -euo pipefail
cd "$(dirname "$0")"
exec python3 tools/serve.py "${1:-8765}"
