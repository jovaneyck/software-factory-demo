---
description: Run the factory loop — sync GitHub, triage, dispatch workers
argument-hint: "[issue-id]"
---
Run the factory loop now.

1. Sync: `export GITHUB_TOKEN=$(gh auth token) && bd github sync`
2. Find work: `bd ready --json`
3. ${1:-Pick the highest-priority ready issue}
4. Follow the foreman skill instructions: claim → worktree → spawn worker → monitor → spawn reviewer → report
