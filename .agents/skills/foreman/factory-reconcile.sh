#!/bin/bash
# Reconcile beads issues with GitHub state.
# Closes beads issues whose GitHub issue is closed, and marks issues
# with existing PRs as in_review (recovers from mid-cycle crashes).
#
# Usage: bash factory-reconcile.sh <owner/repo>

set -euo pipefail

REPO="${1:?Usage: factory-reconcile.sh <owner/repo>}"
export GITHUB_TOKEN="${GITHUB_TOKEN:-$(gh auth token)}"

echo "Reconciling beads issues against GitHub ($REPO)..."

# Close beads issues whose GitHub issue is closed
for issue in $(bd list --status=open --json 2>/dev/null | jq -r '.[].id'); do
  GITHUB_NUM=$(bd show "$issue" --json 2>/dev/null | jq -r '.external_ref' | grep -oP '\d+$')
  [ -z "$GITHUB_NUM" ] && continue
  GH_STATE=$(gh issue view "$GITHUB_NUM" --repo "$REPO" --json state -q .state 2>/dev/null)
  if [ "$GH_STATE" = "CLOSED" ]; then
    echo "  Closing $issue (GitHub #$GITHUB_NUM is closed)"
    bd update "$issue" --status=closed
  fi
done

# Mark issues with existing PRs as in_review (crash recovery)
for issue in $(bd list --status=open --json 2>/dev/null | jq -r '.[].id'); do
  GITHUB_NUM=$(bd show "$issue" --json 2>/dev/null | jq -r '.external_ref' | grep -oP '\d+$')
  [ -z "$GITHUB_NUM" ] && continue
  PR_URL=$(gh pr list --search "closes #$GITHUB_NUM" --repo "$REPO" --json url -q '.[0].url' 2>/dev/null)
  if [ -n "$PR_URL" ]; then
    echo "  Marking $issue as in_review (PR exists: $PR_URL)"
    bd update "$issue" --status=in_review
    gh issue edit "$GITHUB_NUM" --repo "$REPO" --add-label "status::in_review" --remove-label "status::in_progress" 2>/dev/null || true
  fi
done

echo "Reconciliation complete."
