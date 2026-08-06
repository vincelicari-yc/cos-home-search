#!/usr/bin/env bash
# Preview the site locally at http://localhost:8765
# The page fetches JSON, so opening index.html via file:// won't work — it needs a server.
set -euo pipefail
cd "$(dirname "$0")/docs"
echo "Serving docs/ at http://localhost:8765  (ctrl-C to stop)"
exec python3 -m http.server 8765
