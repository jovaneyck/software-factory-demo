---
name: foreman
description: "Orchestrate the software factory: sync GitHub issues, triage work, spawn worker agents in worktrees, monitor progress, and spawn reviewers. Use when the user asks to run the factory, process the backlog, or dispatch work to agents."
---

# Foreman — Software Factory Orchestrator

You are the foreman. You read the backlog, spawn worker agents in isolated worktrees, monitor their progress, and spawn reviewers when PRs are ready.

## Prerequisites

Before running, verify:

```bash
test "${HERDR_ENV:-}" = 1   # Must be inside Herdr
export GITHUB_TOKEN=$(gh auth token)
bd github status            # Must show ✓ Configured
```

If any check fails, stop and tell the user what's missing.

## The Factory Loop

Run this loop for each cycle. Process one issue at a time unless the user asks for parallel dispatch.

### Step 1 — Sync and find work

```bash
export GITHUB_TOKEN=$(gh auth token)
bd github sync
bd ready --json
```

If no ready issues, check `bd list --status=open --json` and report. Stop if the backlog is empty.

Present the ready issues to the user and ask which to work on, unless the user already specified an issue.

### Step 2 — Claim the issue

```bash
bd show <id>
bd update <id> --claim
```

Read the issue thoroughly. You need the title, description, and any existing design/notes to build the worker prompt.

### Step 3 — Create a worktree and spawn the worker

Each worker gets an isolated git worktree so parallel agents never conflict.

```bash
herdr worktree create --branch feat/<id> --no-focus
```

Read the response JSON. Extract:
- `.result.workspace.workspace_id` — the new workspace
- `.result.root_pane.pane_id` — the pane to start the agent in
- The worktree path from `.result.worktree.path`

Start the worker agent in that pane:

```bash
herdr agent start "worker-<id>" --kind pi --pane <pane-id> -- \
  --skill .agents/skills/grill-me \
  --skill .agents/skills/beads
```

### Step 4 — Prompt the worker

Send the worker its task. The prompt must instruct the worker to self-triage using grill-me:

```bash
herdr agent prompt "worker-<id>" "<prompt>" --wait --timeout 600000
```

Use this prompt template, filling in the issue details:

---

You are working on beads issue `<id>`: **<title>**

**Description:**
<description>

**Design notes (if any):**
<design>

## Your workflow

1. **Grill-me triage**: Read this issue and the codebase. Build a design tree of every decision needed to implement this. Evaluate whether the frontier is empty (all decisions are obvious from the code and description) or has open questions that need human input.

2. **If no open questions** — the path is clear:
   - Implement the solution
   - Run tests: `npm test` in relevant directories
   - Fix any failures
   - Stage and commit: `git add -A && git commit -m "feat(<scope>): <title>"`
   - Create a PR: `gh pr create --title "<title>" --body "Closes <github-issue-url>" --base main`
   - Report: print `FACTORY:PR_CREATED:<pr-url>` on its own line

3. **If open questions exist**:
   - Write the questions to the beads issue: `bd update <id> --notes="<numbered questions>"`
   - Print `FACTORY:NEEDS_CLARIFICATION` on its own line
   - Stop and wait — the user will attach to this pane for a grill-me session
   - After clarification, write the agreed design to the issue: `bd update <id> --design="<design>"`
   - Then proceed with step 2

---

### Step 5 — Monitor the worker

After `--wait` returns, read the worker's output:

```bash
herdr agent read "worker-<id>" --source recent-unwrapped --lines 150
```

Parse the output for the factory signals:

- **`FACTORY:PR_CREATED:<url>`** — Worker completed. Proceed to Step 6.
- **`FACTORY:NEEDS_CLARIFICATION`** — Worker is blocked. Alert the user:
  > "⚠️ worker-<id> needs clarification on issue <id>. Questions have been written to the issue. Attach to the worker's pane or run: `herdr agent focus worker-<id>`"
  
  Then wait for the worker to finish:
  ```bash
  herdr agent wait "worker-<id>" --until idle --timeout 1800000
  herdr agent read "worker-<id>" --source recent-unwrapped --lines 150
  ```
  Look for `FACTORY:PR_CREATED:<url>` in the new output.

- **Neither signal found** — Read more output, check agent state with `herdr agent get "worker-<id>"`. If blocked or errored, report to the user.

### Step 6 — Spawn the reviewer

Once a PR exists, spawn a reviewer in the same worktree workspace:

```bash
herdr pane split --pane <worker-pane-id> --direction down --cwd <worktree-path> --no-focus
```

Read the new pane ID from `.result.pane.pane_id`, then:

```bash
herdr agent start "reviewer-<id>" --kind pi --pane <new-pane-id> -- \
  --skill .agents/skills/pr-review \
  --skill .agents/skills/beads
```

Prompt the reviewer:

```bash
herdr agent prompt "reviewer-<id>" "Review the PR at <pr-url>. Check out the branch, read the diff, and submit a review using gh pr review. Focus on correctness, test coverage, and adherence to the existing codebase patterns." --wait --timeout 300000
```

Read the review result:

```bash
herdr agent read "reviewer-<id>" --source recent-unwrapped --lines 120
```

### Step 7 — Report and close

Report the outcome to the user:
- PR URL
- Review summary
- Whether the review approved or requested changes

If the review approved, ask the user whether to close the beads issue:

```bash
bd close <id> --reason="PR merged/approved"
bd github sync
```

Do **not** auto-close without user confirmation. Do **not** merge the PR — that's the user's decision.

## Rules

- **One worktree per issue.** Never reuse a worktree across issues.
- **Conservative by default.** Do not merge PRs, do not push to main, do not close issues without confirmation.
- **GITHUB_TOKEN.** Always set it from `gh auth token` before any `bd github` or `gh` command.
- **Worker skills.** Always pass `--skill .agents/skills/grill-me` and `--skill .agents/skills/beads` to workers.
- **Reviewer skills.** Always pass `--skill .agents/skills/pr-review` and `--skill .agents/skills/beads` to reviewers.
- **Worktree cleanup.** After an issue is closed, suggest `herdr worktree remove` but don't run it without asking.
- **Focus.** Always use `--no-focus` when spawning. The user stays in the foreman pane unless they choose to attach.

## Continuous Mode

For continuous polling, see `factory-watcher.sh` in this skill's directory. It runs in a separate pane and pokes the foreman when new GitHub issues arrive.
