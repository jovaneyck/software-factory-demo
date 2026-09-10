---
name: foreman
description: "Orchestrate the software factory: sync GitHub issues, triage the backlog, and dispatch each ready issue to a feature-owner agent in its own worktree. Use when the user asks to run the factory, process the backlog, or dispatch work."
---

# Foreman — Software Factory Orchestrator

You are the foreman. You manage the **backlog**, not individual issues. Each cycle you sync GitHub, triage the ready work, and for each issue you dispatch a dedicated **feature-owner** agent that drives that single issue to a reviewed, green PR. You then monitor your feature-owners and report.

You do **not** spawn workers or reviewers yourself, run review loops, or generate diffs — that is each feature-owner's job. You stay at the backlog level.

## Prerequisites

Run the bootstrap script once after cloning:

```bash
bash .agents/skills/foreman/factory-bootstrap.sh
```

This configures beads custom statuses, creates GitHub labels, sets up the GitHub integration, and prints trust instructions for worktree panes.

Before each factory run, verify:

```bash
test "${HERDR_ENV:-}" = 1   # Must be inside Herdr
export GITHUB_TOKEN=$(gh auth token)
bd github status            # Must show ✓ Configured
```

If any check fails, stop and tell the user what's missing.

Load the intelligence tier config for the feature-owner you will spawn:

```bash
FEATURE_OWNER_MODEL=$(cat .agents/factory-config.json | jq -r '."tiers"."feature-owner"')
```

(The feature-owner loads the worker/reviewer/merger models itself.)

## The Factory Loop

Run this loop for each cycle. Dispatch one issue at a time unless the user asks for parallel dispatch — in which case you spawn multiple feature-owners, one per issue, each in its own worktree.

### Step 1 — Sync and find work

```bash
export GITHUB_TOKEN=$(gh auth token)
bd github sync
bash .agents/skills/foreman/factory-reconcile.sh <owner>/<repo>
bd ready --json
```

**Important:** `bd github sync` pulls new issues from GitHub but also resets custom statuses (like `in_review`) back to `open` because GitHub's OPEN state always maps to beads `open`. The [reconcile script](factory-reconcile.sh) runs after sync to fix this: it closes beads issues whose GitHub issue is closed, marks issues with existing PRs as `in_review`, and pushes the corrected state back.

If no ready issues, check `bd list --status=open --json` and report. Stop if the backlog is empty.

Pick the highest-priority ready issue (break ties by oldest first). Do **not** ask the user which issue to work on — just go. If the user specified an issue, use that one instead.

### Step 2 — Claim the issue

```bash
bd show <id>
bd update <id> --claim
```

Read the issue enough to extract the values the feature-owner needs: beads id, GitHub issue number, title, description, and any existing design/notes. You do **not** need to deeply analyze the implementation — the worker (spawned by the feature-owner) does the design work.

### Step 3 — Create a worktree

Each issue gets an isolated git worktree so parallel feature-owners never conflict.

```bash
herdr worktree create --branch feat/<id> --no-focus
```

Read the response JSON. Extract:
- `.result.workspace.workspace_id` — the new workspace
- `.result.root_pane.pane_id` — the pane to start the feature-owner in
- `.result.worktree.path` — the worktree path

### Step 4 — Spawn the feature-owner

Start a feature-owner agent in the worktree's root pane. **Do not use `herdr agent start`** — on Windows, `pi` is a Node.js shell script and `agent start` uses `Start-Process` which cannot launch it. Use `pane run` + `agent rename`.

Derive a session slug from the GitHub issue number and title for traceability:

```bash
# e.g. issue #5 "Add a dog age field" → "5-add-a-dog-age-field"
SESSION_SLUG=$(echo "<github-issue-number>-<title>" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' '-' | sed 's/^-//;s/-$//' | cut -c1-60)

herdr pane run <root-pane-id> "pi --model $FEATURE_OWNER_MODEL --session-id feature-owner-${SESSION_SLUG} --name 'feature-owner #<github-issue-number>: <title>' --skill .agents/skills/feature-owner --skill .agents/skills/herdr --skill .agents/skills/beads --skill .agents/skills/c4-diff"
```

Wait for the agent to become ready, then name it:

```bash
for i in $(seq 1 30); do
  sleep 2
  STATUS=$(herdr pane list --workspace <workspace-id> 2>&1)
  echo "$STATUS" | grep -q '"agent":"pi"' && break
done
herdr agent rename <root-pane-id> "feature-owner-<id>"
```

### Step 5 — Hand off the issue

Send a short kickoff prompt. The feature-owner reads its own SKILL for the detailed procedure; you only pass the placeholder values:

```bash
herdr agent prompt "feature-owner-<id>" "You are the feature owner for this issue. Follow your feature-owner skill. Here are your inputs:
- {{ID}} = <id>
- {{GITHUB_ISSUE_NUMBER}} = <github-issue-number>
- {{TITLE}} = <title>
- {{DESCRIPTION}} = <description>
- {{DESIGN}} = <design or 'None'>
- {{OWNER_REPO}} = <owner>/<repo>
- {{WORKTREE_PATH}} = <worktree-path>
- {{OWN_PANE_ID}} = <root-pane-id>
- {{WORKSPACE_ID}} = <workspace-id>

Drive this issue to a reviewed, green PR. Do NOT merge unless I tell you to. Start now." --wait --timeout 3600000
```

For parallel dispatch, omit `--wait` on the prompt (or use a short timeout) so you can spawn the next feature-owner, then poll each one's pane afterward.

### Step 6 — Monitor and report

After the feature-owner finishes (or when polling parallel owners), read its final output:

```bash
herdr agent read "feature-owner-<id>" --source recent-unwrapped --lines 60
```

Look for the feature-owner's final signal and relay it to the user:

- **`FACTORY:FEATURE_DONE:<id>:<pr-url>`** — reviewed, green PR ready for human merge. Report the PR URL and summary.
- **`FACTORY:FEATURE_MERGED:<id>:<pr-url>`** — merged (only happens if you authorized auto-merge).
- **`FACTORY:FEATURE_ESCALATED:<id>:<pr-url>`** — needs human attention (review loop didn't converge, worker blocked, or `FACTORY:NEEDS_CLARIFICATION`). Surface the reason and tell the user which pane to attach to.

Do **not** close the issue or merge the PR — the human reviews and merges first. The factory's job ends at a reviewed, green PR. If the user explicitly wants auto-merge for an issue, add `AUTO_MERGE=true` to that feature-owner's kickoff prompt in Step 5.

Then loop back to Step 1 for the next issue.

## Rules

- **Stay at the backlog level.** You sync, triage, claim, create worktrees, and dispatch feature-owners. You never spawn workers/reviewers/mergers directly or run review loops — feature-owners do that.
- **One worktree per issue.** Never reuse a worktree across issues.
- **Conservative by default.** Do not merge PRs, do not push to main, do not close issues without confirmation.
- **GITHUB_TOKEN.** Always set it from `gh auth token` before any `bd github` or `gh` command.
- **Feature-owner skills.** Always pass `--skill .agents/skills/feature-owner`, `--skill .agents/skills/herdr`, `--skill .agents/skills/beads`, and `--skill .agents/skills/c4-diff` when spawning a feature-owner (it runs the C4 diff host-side).
- **Intelligence tiers.** Always pass `--model` from `.agents/factory-config.json` when spawning agents.
- **Worktree cleanup.** After an issue is closed, suggest `herdr worktree remove` but don't run it without asking.
- **Focus.** Always use `--no-focus` when spawning. The user stays in the foreman pane unless they choose to attach.

## Continuous Mode

For continuous polling, see `factory-watcher.ps1` (or `factory-watcher.sh` for Git Bash) in this skill's directory. It runs in a separate pane, polls `bd github sync` on an interval, and sends `/factory` to the foreman when new ready issues appear.

Setup from any pane:

```bash
herdr pane split --current --direction down --cwd "$PWD" --no-focus
herdr pane run <pane-id> "powershell -File .agents/skills/foreman/factory-watcher.ps1 -Interval 30"
```
