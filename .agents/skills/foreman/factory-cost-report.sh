#!/usr/bin/env bash
# factory-cost-report.sh — collect token costs from agents and post to PR
#
# Usage:
#   bash .agents/skills/foreman/factory-cost-report.sh <pr-number> <owner-pane-id> <worker-pane-id> <reviewer-pane-id> <repo>
#
# The feature-owner cost covers GitHub integration + orchestration (push, PR,
# comments/labels, bd updates, C4 diff, driving the worker/reviewer).

set -euo pipefail

PR_NUMBER="$1"
OWNER_PANE="$2"
WORKER_PANE="$3"
REVIEWER_PANE="$4"
REPO="${5:-jovaneyck/software-factory-demo}"
CONFIG=".agents/factory-config.json"

extract_cost() {
  herdr pane read "$1" --source visible --lines 1 2>/dev/null \
    | grep -oE '\$[0-9]+\.[0-9]+' \
    | head -1 \
    | tr -d '$'
}

# Config reads via node (jq isn't reliably on the pane PATH)
get_tier() {
  node -e 'const c=require("./"+process.argv[1]);console.log((c.tiers&&c.tiers[process.argv[2]])||"unknown")' "$CONFIG" "$1" 2>/dev/null || echo "unknown"
}

OWNER_COST=$(extract_cost "$OWNER_PANE")
WORKER_COST=$(extract_cost "$WORKER_PANE")
REVIEWER_COST=$(extract_cost "$REVIEWER_PANE")
OWNER_MODEL=$(get_tier "feature-owner")
WORKER_MODEL=$(get_tier "worker")
REVIEWER_MODEL=$(get_tier "reviewer")

if [[ -z "$OWNER_COST" ]]; then OWNER_COST="0.000"; fi
if [[ -z "$WORKER_COST" ]]; then WORKER_COST="0.000"; fi
if [[ -z "$REVIEWER_COST" ]]; then REVIEWER_COST="0.000"; fi

TOTAL=$(node -e 'console.log((Number(process.argv[1])+Number(process.argv[2])+Number(process.argv[3])).toFixed(3))' "$OWNER_COST" "$WORKER_COST" "$REVIEWER_COST")

echo "[cost] Feature-owner: \$$OWNER_COST"
echo "[cost] Worker:        \$$WORKER_COST"
echo "[cost] Reviewer:      \$$REVIEWER_COST"
echo "[cost] Total:         \$$TOTAL"

export GITHUB_TOKEN="${GITHUB_TOKEN:-$(gh auth token)}"

gh pr comment "$PR_NUMBER" --repo "$REPO" --body "## Factory Cost Report
| Agent | Model | Cost |
|-------|-------|------|
| Feature-owner (GitHub integration + orchestration) | \`$OWNER_MODEL\` | \$$OWNER_COST |
| Worker (grill + implement + fix) | \`$WORKER_MODEL\` | \$$WORKER_COST |
| Reviewer | \`$REVIEWER_MODEL\` | \$$REVIEWER_COST |
| **Total** | | **\$$TOTAL** |"

echo "[cost] Posted to PR #$PR_NUMBER"
