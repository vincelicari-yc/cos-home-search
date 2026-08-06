#!/usr/bin/env bash
# Block until a house is waiting in the drop queue, then exit.
#
# Run this in the background and the shell's completion notification wakes Claude exactly when a
# link is sent from the page — no polling loop burning tokens while nothing is happening.
# Re-arm it after each batch is processed.
#
#   ./tools/watch-queue.sh [max_seconds]
#
# Exit 0 = work is waiting. Exit 3 = timed out with an empty queue.
set -uo pipefail
cd "$(dirname "$0")/.."
QUEUE=data/queue.json
MAX=${1:-3600}
STEP=3
waited=0

pending_count() {
  python3 - <<'PY' 2>/dev/null || echo 0
import json, pathlib
p = pathlib.Path("data/queue.json")
if not p.exists():
    print(0); raise SystemExit
try:
    q = json.loads(p.read_text())
except Exception:
    print(0); raise SystemExit
# Only entries nobody has started yet.
print(sum(1 for x in q.get("pending", []) if (x.get("status") or "queued") == "queued"))
PY
}

start=$(pending_count)
echo "watching $QUEUE — $start already queued, waiting for something new"

while [ "$waited" -lt "$MAX" ]; do
  n=$(pending_count)
  if [ "$n" -gt "$start" ] 2>/dev/null; then
    echo "QUEUE HAS WORK: $n waiting"
    python3 - <<'PY'
import json, pathlib
q = json.loads(pathlib.Path("data/queue.json").read_text())
for x in q.get("pending", []):
    if (x.get("status") or "queued") == "queued":
        print(f"  - {x.get('address') or x.get('url')}")
        print(f"    {x.get('url')}")
PY
    exit 0
  fi
  sleep "$STEP"
  waited=$((waited + STEP))
done
echo "timed out after ${MAX}s with nothing new queued"
exit 3
