#!/usr/bin/env bash
# factory-cost-report.sh — collect token costs from agents and post to PR
#
# Usage:
#   bash .agents/skills/foreman/factory-cost-report.sh <pr-number> <worker-pane-id> <reviewer-pane-id> <repo>

set -euo pipefail

PR_NUMBER="$1"
WORKER_PANE="$2"
REVIEWER_PANE="$3"
REPO="${4:-jovaneyck/software-factory-demo}"

extract_cost() {
  herdr pane read "$1" --source visible --lines 1 2>/dev/null \
    | grep -oP '\$[0-9]+\.[0-9]+' \
    | head -1 \
    | tr -d '$'
}

WORKER_COST=$(extract_cost "$WORKER_PANE")
REVIEWER_COST=$(extract_cost "$REVIEWER_PANE")

if [[ -z "$WORKER_COST" ]]; then WORKER_COST="0.000"; fi
if [[ -z "$REVIEWER_COST" ]]; then REVIEWER_COST="0.000"; fi

TOTAL=$(echo "$WORKER_COST + $REVIEWER_COST" | bc)

echo "[cost] Worker:   \$$WORKER_COST"
echo "[cost] Reviewer: \$$REVIEWER_COST"
echo "[cost] Total:    \$$TOTAL"

export GITHUB_TOKEN="${GITHUB_TOKEN:-$(gh auth token)}"

gh pr comment "$PR_NUMBER" --repo "$REPO" --body "## Factory Cost Report
| Agent | Cost |
|-------|------|
| Worker (grill + implement + fix) | \$$WORKER_COST |
| Reviewer | \$$REVIEWER_COST |
| **Total** | **\$$TOTAL** |"

echo "[cost] Posted to PR #$PR_NUMBER"
