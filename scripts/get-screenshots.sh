#!/usr/bin/env bash
# Download latest screenshot artifact from GitHub Actions
# Usage: ./scripts/get-screenshots.sh [repo]
# Requires: gh CLI authenticated

set -euo pipefail

REPO="${1:-$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo "kentavr34/chesscoin")}"
OUTDIR="./screenshots"

echo "Fetching latest screenshot artifact from $REPO..."

# Get latest successful run of screenshot workflow
RUN_ID=$(gh run list \
  --repo "$REPO" \
  --workflow "screenshot.yml" \
  --status success \
  --limit 1 \
  --json databaseId \
  -q '.[0].databaseId' 2>/dev/null || echo "")

if [ -z "$RUN_ID" ]; then
  echo "No successful screenshot workflow runs found."
  echo "Trigger one with: gh workflow run screenshot.yml --repo $REPO"
  exit 1
fi

echo "Found run #$RUN_ID — downloading artifact..."
mkdir -p "$OUTDIR"

# Download the artifact zip
gh run download "$RUN_ID" \
  --repo "$REPO" \
  --dir "$OUTDIR" \
  --pattern "screenshots-*" 2>/dev/null || {
    # Fallback: list artifacts and download first one
    gh run download "$RUN_ID" --repo "$REPO" --dir "$OUTDIR"
  }

# Flatten nested dirs if any
find "$OUTDIR" -mindepth 2 -name "*.png" -exec mv {} "$OUTDIR/" \; 2>/dev/null || true
find "$OUTDIR" -mindepth 2 -name "*.json" -exec mv {} "$OUTDIR/" \; 2>/dev/null || true

echo ""
echo "Screenshots saved to $OUTDIR/:"
ls -1 "$OUTDIR"/*.png 2>/dev/null | sed 's|.*/||'
echo ""
if [ -f "$OUTDIR/api_report.json" ]; then
  echo "API report:"
  cat "$OUTDIR/api_report.json"
fi
