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

# Get all open beads issue IDs and their GitHub numbers
ISSUES_JSON=$(bd list --status=open --json 2>/dev/null || echo "[]")
ISSUE_IDS=$(echo "$ISSUES_JSON" | node -e "
  let d=''; process.stdin.on('data',c=>d+=c);
  process.stdin.on('end',()=>{
    const issues=JSON.parse(d);
    issues.forEach(i=>{
      const m=i.external_ref&&i.external_ref.match(/(\d+)$/);
      if(m) console.log(i.id+' '+m[1]);
    });
  });
")

if [ -z "$ISSUE_IDS" ]; then
  echo "  No open issues to reconcile."
  echo "Reconciliation complete."
  exit 0
fi

# Close beads issues whose GitHub issue is closed
while IFS=' ' read -r BEAD_ID GITHUB_NUM; do
  GH_STATE=$(gh issue view "$GITHUB_NUM" --repo "$REPO" --json state -q .state 2>/dev/null || echo "")
  if [ "$GH_STATE" = "CLOSED" ]; then
    echo "  Closing $BEAD_ID (GitHub #$GITHUB_NUM is closed)"
    bd update "$BEAD_ID" --status=closed
  elif [ -z "$GH_STATE" ]; then
    echo "  Closing $BEAD_ID (GitHub #$GITHUB_NUM is deleted or inaccessible)"
    bd update "$BEAD_ID" --status=closed
  fi
done <<< "$ISSUE_IDS"

# Build a map of GitHub issue numbers to open PRs (by parsing PR bodies)
# This avoids GitHub's fuzzy search which matches incorrectly
PR_CLOSES_MAP=$(gh pr list --repo "$REPO" --state open --json number,url,body 2>/dev/null | node -e "
  let d=''; process.stdin.on('data',c=>d+=c);
  process.stdin.on('end',()=>{
    const prs=JSON.parse(d);
    prs.forEach(pr=>{
      const matches=[...pr.body.matchAll(/closes\s+(?:https:\/\/github\.com\/[^\/]+\/[^\/]+\/issues\/|#)(\d+)/gi)];
      matches.forEach(m=>console.log(m[1]+' '+pr.url));
    });
  });
")

# Re-read open issues (some may have just been closed)
ISSUES_JSON=$(bd list --status=open --json 2>/dev/null || echo "[]")
ISSUE_IDS=$(echo "$ISSUES_JSON" | node -e "
  let d=''; process.stdin.on('data',c=>d+=c);
  process.stdin.on('end',()=>{
    const issues=JSON.parse(d);
    issues.forEach(i=>{
      const m=i.external_ref&&i.external_ref.match(/(\d+)$/);
      if(m) console.log(i.id+' '+m[1]);
    });
  });
")

# Mark issues with existing PRs as in_review (crash recovery)
if [ -n "$ISSUE_IDS" ]; then
  while IFS=' ' read -r BEAD_ID GITHUB_NUM; do
    PR_URL=$(echo "$PR_CLOSES_MAP" | grep "^${GITHUB_NUM} " | head -1 | cut -d' ' -f2)
    if [ -n "$PR_URL" ]; then
      echo "  Marking $BEAD_ID as in_review (PR exists: $PR_URL)"
      bd update "$BEAD_ID" --status=in_review
      gh issue edit "$GITHUB_NUM" --repo "$REPO" --add-label "status::in_review" --remove-label "status::in_progress" 2>/dev/null || true
    fi
  done <<< "$ISSUE_IDS"
fi

# Push reconciled state back so next sync doesn't revert it
bd github sync --push-only 2>/dev/null

echo "Reconciliation complete."
