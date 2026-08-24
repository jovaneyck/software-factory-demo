#!/bin/bash
# Seed the backend data directory with test data.
# Run from the repo root of a worktree to populate app/backend/data/
# with realistic sample data for screenshots and manual testing.
#
# Usage: bash .agents/skills/foreman/factory-seed-data.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
SEED_SOURCE="$REPO_ROOT/app/backend/seed-data"
DATA_TARGET="./app/backend/data"

# If running in a worktree, seed-data won't exist locally — use the main repo's copy
if [ ! -d "$SEED_SOURCE" ]; then
  # Try finding it via git's main worktree
  MAIN_WORKTREE=$(git worktree list --porcelain | head -1 | sed 's/worktree //')
  SEED_SOURCE="$MAIN_WORKTREE/app/backend/seed-data"
fi

if [ ! -d "$SEED_SOURCE" ]; then
  echo "ERROR: Cannot find seed-data directory"
  exit 1
fi

if [ -d "$DATA_TARGET" ] && [ "$(ls -A "$DATA_TARGET" 2>/dev/null)" ]; then
  echo "Data directory already has content, skipping seed."
  exit 0
fi

echo "Seeding data from $SEED_SOURCE..."
mkdir -p "$DATA_TARGET"
cp -r "$SEED_SOURCE"/* "$DATA_TARGET"/
echo "Done — seeded $(find "$DATA_TARGET" -type f | wc -l) files."
