#!/usr/bin/env bash
# Sync canonical data into the published site and push.
#
#   ./deploy.sh                 sync + commit + push
#   ./deploy.sh "message"       same, with your own commit message
#   ./deploy.sh --dry           sync only, no git (use with serve.sh to preview)
#
# data/ is the source of truth. docs/data/ is generated — never edit it by hand.
set -euo pipefail
cd "$(dirname "$0")"

DATA_FILES=(homes.json anchors.json rubric.json checklist.json drivetimes.json)

echo "Syncing data -> docs/data"
mkdir -p docs/data
for f in "${DATA_FILES[@]}"; do
  if [[ -f "data/$f" ]]; then
    # Fail loudly on malformed JSON rather than publishing a page that silently won't load.
    python3 -c "import json,sys; json.load(open('data/$f'))" \
      || { echo "  ERROR: data/$f is not valid JSON — aborting."; exit 1; }
    cp "data/$f" "docs/data/$f"
    echo "  ok  $f"
  else
    echo "  --  $f (missing, skipped)"
  fi
done

# The whole point of the site: findable by the family, not by Google.
grep -q 'noindex' docs/index.html || { echo "ERROR: noindex meta tag missing from docs/index.html"; exit 1; }
[[ -f docs/robots.txt ]] || { echo "ERROR: docs/robots.txt missing"; exit 1; }
echo "noindex + robots.txt present"

if [[ "${1:-}" == "--dry" ]]; then
  echo "Dry run — nothing committed."
  exit 0
fi

if [[ -z "$(git status --porcelain)" ]]; then
  echo "Nothing to commit."
  exit 0
fi

git add -A
git commit -q -m "${1:-Update home search data}"
git push -q origin HEAD
echo "Pushed. GitHub Pages usually reflects it within a minute."
