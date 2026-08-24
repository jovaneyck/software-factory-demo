---
name: foreman
description: "Orchestrate the software factory: sync GitHub issues, triage work, spawn worker agents in worktrees, monitor progress, and spawn reviewers. Use when the user asks to run the factory, process the backlog, or dispatch work to agents."
---

# Foreman — Software Factory Orchestrator

You are the foreman. You read the backlog, spawn worker agents in isolated worktrees, monitor their progress, and spawn reviewers when PRs are ready.

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

## The Factory Loop

Run this loop for each cycle. Process one issue at a time unless the user asks for parallel dispatch.

### Step 1 — Sync and find work

```bash
export GITHUB_TOKEN=$(gh auth token)
bd github sync
bash .agents/skills/foreman/factory-reconcile.sh <owner>/<repo>
bd ready --json
```

**Important:** `bd github sync` pulls new issues from GitHub but also resets custom statuses (like `in_review`) back to `open` because GitHub's OPEN state always maps to beads `open`. The [reconcile script](factory-reconcile.sh) runs after sync to fix this: it closes beads issues whose GitHub issue is closed, marks issues with existing PRs as `in_review`, and pushes the corrected state back.

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

Start the worker agent in that pane. **Do not use `herdr agent start`** — on Windows, `pi` is a Node.js shell script and `agent start` uses `Start-Process` which cannot launch it. Instead, use `pane run` + `agent rename`:

```bash
herdr pane run <pane-id> "pi --skill .agents/skills/grill-me --skill .agents/skills/beads"
```

Wait for the agent to become ready (poll until herdr detects a pi agent in the pane):

```bash
# Poll until the pane shows a pi agent
for i in $(seq 1 30); do
  sleep 2
  STATUS=$(herdr pane list --workspace <workspace-id> 2>&1)
  echo "$STATUS" | grep -q '"agent":"pi"' && break
done
```

Then name it:

```bash
herdr agent rename <pane-id> "worker-<id>"
```

### Step 4 — Prompt the worker

Send a short prompt that tells the worker to read its instructions from the prompt file. Do **not** read the prompt file yourself — that pollutes your context. Pass only the placeholder values:

```bash
herdr agent prompt "worker-<id>" "Read your full instructions from .agents/skills/foreman/prompts/worker-prompt.md and follow them. Replace the placeholders with these values:
- {{ID}} = <id>
- {{TITLE}} = <title>
- {{DESCRIPTION}} = <description>
- {{DESIGN}} = <design or 'None'>

Start now." --wait --timeout 600000
```

---

### Step 5 — Monitor the worker

After `--wait` returns, read the worker's output:

```bash
herdr agent read "worker-<id>" --source recent-unwrapped --lines 150
```

Parse the output for the factory signals:

- **`FACTORY:FRONTIER_CLEAR`** — Worker self-triaged and is proceeding to implementation. Continue monitoring for `FACTORY:PR_CREATED`.
- **`FACTORY:PR_CREATED:<url>`** — Worker completed. Proceed to Step 6.
- **`FACTORY:NEEDS_CLARIFICATION`** — Worker has open design questions. Alert the user:
  > "⚠️ worker-<id> needs clarification on issue <id>. Open questions have been written to the issue. Attach to the worker's pane or run: `herdr agent focus worker-<id>`"
  
  Then wait for the worker to finish after the user clarifies:
  ```bash
  herdr agent wait "worker-<id>" --until idle --timeout 1800000
  herdr agent read "worker-<id>" --source recent-unwrapped --lines 150
  ```
  Look for `FACTORY:PR_CREATED:<url>` in the new output.

- **Neither signal found** — Read more output, check agent state with `herdr agent get "worker-<id>"`. If blocked or errored, report to the user.

### Step 6 — Review and fix cycle (automatic, no human input)

Once a PR exists, spawn a reviewer in the same worktree workspace:

```bash
herdr pane split --pane <worker-pane-id> --direction down --cwd <worktree-path> --no-focus
```

Read the new pane ID from `.result.pane.pane_id`, then:

```bash
herdr pane run <new-pane-id> "pi --skill .agents/skills/pr-review --skill .agents/skills/beads"
```

Wait for the agent to become ready, then name it:

```bash
for i in $(seq 1 30); do
  sleep 2
  herdr agent list 2>&1 | grep -q '<new-pane-id>' && break
done
herdr agent rename <new-pane-id> "reviewer-<id>"
```

Send a short prompt that tells the reviewer to read its instructions from the prompt file. Do **not** read the prompt file yourself:

```bash
herdr agent prompt "reviewer-<id>" "Read your full instructions from .agents/skills/foreman/prompts/reviewer-prompt.md and follow them. Replace the placeholders with these values:
- {{PR_URL}} = <pr-url>

Start now." --wait --timeout 300000
```

Read the review result:

```bash
herdr agent read "reviewer-<id>" --source recent-unwrapped --lines 30
```

Check only whether the reviewer found issues or not (look for keywords like "no issues", "looks good", "LGTM" vs "missing", "should", "bug", "issue"). Do NOT read the full review content — that bloats your context window.

If the reviewer found issues, tell the worker to read them directly from GitHub and fix:

```bash
herdr agent prompt "worker-<id>" "The reviewer left feedback on PR #<pr-number>. Read the review comments with: gh pr view <pr-number> --comments. Address ALL issues, run tests and linter, commit, and push. Print FACTORY:FIXES_PUSHED when done." --wait --timeout 600000
```

After the worker pushes fixes, read its output and verify `FACTORY:FIXES_PUSHED`.

If the reviewer had no issues, skip straight to Step 7.

### Step 7 — Cost report and status update

Post token costs from all agents as a PR comment:

```bash
bash .agents/skills/foreman/factory-cost-report.sh <pr-number> <worker-pane-id> <reviewer-pane-id> <owner/repo>
```

Then mark the issue as ready for human review:

```bash
bd update <id> --status=in_review
export GITHUB_TOKEN=$(gh auth token)
bd github sync --push-only
# Beads custom statuses don't sync as GitHub labels automatically, so apply directly:
gh issue edit <github-issue-number> --repo <owner>/<repo> --add-label "status::in_review" --remove-label "status::in_progress"
```

Report the final outcome to the user. Do not ask questions — just present the result:
- PR URL
- Review summary (what was found, what was fixed)
- Final test/lint status

Do **not** close the issue — the human reviews and merges first. Do **not** merge the PR — that is the user's decision. The factory's job ends at a reviewed, green PR.

## Rules

- **One worktree per issue.** Never reuse a worktree across issues.
- **Conservative by default.** Do not merge PRs, do not push to main, do not close issues without confirmation.
- **GITHUB_TOKEN.** Always set it from `gh auth token` before any `bd github` or `gh` command.
- **Worker skills.** Always pass `--skill .agents/skills/grill-me` and `--skill .agents/skills/beads` to workers.
- **Reviewer skills.** Always pass `--skill .agents/skills/pr-review` and `--skill .agents/skills/beads` to reviewers.
- **Worktree cleanup.** After an issue is closed, suggest `herdr worktree remove` but don't run it without asking.
- **Focus.** Always use `--no-focus` when spawning. The user stays in the foreman pane unless they choose to attach.

## Continuous Mode

For continuous polling, see `factory-watcher.ps1` (or `factory-watcher.sh` for Git Bash) in this skill's directory. It runs in a separate pane, polls `bd github sync` on an interval, and sends `/factory` to the foreman when new ready issues appear.

Setup from any pane:

```bash
herdr pane split --current --direction down --cwd "$PWD" --no-focus
herdr pane run <pane-id> "powershell -File .agents/skills/foreman/factory-watcher.ps1 -Interval 30"
```
