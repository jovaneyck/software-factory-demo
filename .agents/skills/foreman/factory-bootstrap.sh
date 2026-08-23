#!/usr/bin/env bash
# factory-bootstrap.sh — one-time setup for the software factory
#
# Run this after cloning the repo to configure beads, GitHub labels,
# and trust settings needed by the factory.
#
# Usage:
#   bash .agents/skills/foreman/factory-bootstrap.sh

set -euo pipefail

REPO="jovaneyck/software-factory-demo"

echo "=== Factory Bootstrap ==="
echo ""

# 1. GitHub token
export GITHUB_TOKEN="${GITHUB_TOKEN:-$(gh auth token 2>/dev/null)}"
if [[ -z "$GITHUB_TOKEN" ]]; then
  echo "ERROR: No GitHub token. Run 'gh auth login' first."
  exit 1
fi
echo "[✓] GitHub token available"

# 2. Beads workspace
if [[ ! -d ".beads" ]]; then
  echo "[!] No .beads directory. Run 'bd init' first."
  exit 1
fi
echo "[✓] Beads workspace exists"

# 3. Beads GitHub integration
bd config set github.owner "$(echo $REPO | cut -d/ -f1)" 2>/dev/null
bd config set github.repo "$(echo $REPO | cut -d/ -f2)" 2>/dev/null
echo "[✓] Beads GitHub integration configured"

# 4. Custom statuses
bd config set status.custom in_review 2>/dev/null
echo "[✓] Custom status 'in_review' registered"

# 5. GitHub labels — create if missing
LABELS=(
  "status::in_progress:#1d76db:Factory - work in progress"
  "status::in_review:#fbca04:Factory - ready for human review"
  "status::closed:#0e8a16:Factory - done"
  "type::task:#ededed:Beads task"
  "type::feature:#ededed:Beads feature"
  "type::bug:#d73a4a:Beads bug"
  "priority::critical:#b60205:P0 - critical"
  "priority::high:#d93f0b:P1 - high"
  "priority::medium:#ededed:P2 - medium"
  "priority::low:#ededed:P3 - low"
  "priority::backlog:#ededed:P4 - backlog"
)

EXISTING_LABELS=$(gh label list --repo "$REPO" --json name --jq '.[].name' 2>/dev/null)

for entry in "${LABELS[@]}"; do
  IFS=: read -r name color desc <<< "$entry"
  if echo "$EXISTING_LABELS" | grep -qx "$name"; then
    echo "  [·] Label '$name' exists"
  else
    gh label create "$name" --color "${color#\#}" --description "$desc" --repo "$REPO" 2>/dev/null
    echo "  [+] Label '$name' created"
  fi
done
echo "[✓] GitHub labels configured"

# 6. Initial sync
bd github sync 2>/dev/null || true
echo "[✓] Initial GitHub sync complete"

# 7. Trust worktree parent for pi (avoids trust prompts on worker panes)
WORKTREE_PARENT="$HOME/.herdr/worktrees/software-factory-demo"
PI_TRUST_FILE="$HOME/.pi/trust.json"
if [[ -f "$PI_TRUST_FILE" ]]; then
  if grep -q "$WORKTREE_PARENT" "$PI_TRUST_FILE" 2>/dev/null; then
    echo "[✓] Worktree parent already trusted by pi"
  else
    echo "[!] Add this to $PI_TRUST_FILE to avoid trust prompts on workers:"
    echo "    $WORKTREE_PARENT"
  fi
else
  echo "[!] Trust the worktree parent folder in pi to avoid trust prompts on workers:"
  echo "    $WORKTREE_PARENT"
fi

echo ""
echo "=== Bootstrap complete ==="
echo ""
echo "Start the factory:"
echo "  1. Launch foreman:  pi --skill .agents/skills/foreman --skill .agents/skills/beads --skill .agents/skills/herdr --prompt-template .agents/skills/foreman/prompts"
echo "  2. Rename agent:    herdr agent rename <pane-id> foreman"
echo "  3. Start watcher:   herdr pane split --current --direction down --cwd \$PWD --no-focus"
echo "                      herdr pane run <pane-id> \"powershell -File .agents/skills/foreman/factory-watcher.ps1 -Interval 30\""
