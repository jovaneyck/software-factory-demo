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

### Phase 1 — Grill-me (MANDATORY, do not skip)

You have the grill-me skill loaded. Use it now.

1. Read the issue description and explore the codebase thoroughly (file structure, existing types, API routes, UI components, tests).
2. Build a **design tree** of every decision needed to implement this issue. Print the full tree.
3. Compute the **frontier** — every decision whose prerequisites are settled and can be asked now. Print the frontier as a numbered list. For each question, give your recommended answer based on what you found in the codebase.
4. For each frontier question, classify it:
   - **RESOLVED**: The answer is unambiguous from the codebase and issue description. State the evidence.
   - **OPEN**: Requires a human decision — multiple valid options exist, or the issue description is ambiguous.

### Phase 2 — Decision

- **If ALL frontier questions are RESOLVED** (frontier is empty of OPEN questions):
  Print `FACTORY:FRONTIER_CLEAR`.
  Sync status to GitHub: `export GITHUB_TOKEN=$(gh auth token) && bd github sync --push-only`
  Then proceed to Phase 3.

- **If ANY frontier question is OPEN**:
  Write the open questions to the beads issue: `bd update <id> --notes="<numbered open questions with recommended answers>"`
  Print `FACTORY:NEEDS_CLARIFICATION` on its own line.
  Stop and wait — the user will attach to this pane for a grill-me session.
  After clarification, write the agreed design to the issue: `bd update <id> --design="<design>"`
  Sync status to GitHub: `export GITHUB_TOKEN=$(gh auth token) && bd github sync --push-only`
  Then proceed to Phase 3.

### Phase 3 — Implementation (only after Phase 1 and 2)

- Install dependencies first: `cd app && npm install`
- Implement the solution
- Fix any failures until tests and linter pass

### Phase 4 — Proof of Work (MANDATORY before PR)

Collect evidence that the change works. This goes into the PR body.

1. **Tests**: Run `npm test` from the `app/` directory. Capture the full output.
2. **Linter**: Run `npm run lint` from the `app/` directory. Capture the full output.
3. **Screenshot** (if frontend files were changed): Pick random available ports to avoid collisions with other workers:
   ```bash
   # Pick random ports in the 3100-3999 and 5200-5999 ranges
   BACKEND_PORT=$((3100 + RANDOM % 900))
   FRONTEND_PORT=$((5200 + RANDOM % 800))
   # Start backend
   PORT=$BACKEND_PORT npm run dev --prefix app/backend &
   # Start frontend (proxy will use BACKEND_PORT via vite.config.ts)
   BACKEND_PORT=$BACKEND_PORT npx vite --port $FRONTEND_PORT --prefix app/frontend &
   # Wait for servers, then screenshot
   npx playwright screenshot --wait-for-timeout 2000 http://localhost:$FRONTEND_PORT/<relevant-path> proof.png
   ```
   Stop the dev servers after capturing (kill the background jobs).

### Phase 5 — PR Submission

- Stage and commit: `git add -A && git commit -m "feat(<scope>): <title>"`
- Create the PR with proof of work in the body:
  ```
  gh pr create --title "<title>" --body "Closes <github-issue-url>

  ## Test Output
  \`\`\`
  <paste test output>
  \`\`\`

  ## Lint Output
  \`\`\`
  <paste lint output>
  \`\`\`

  ## Screenshot
  <if frontend work: upload proof.png to the PR>
  " --base main
  ```
- If a screenshot was captured, commit it and link it in a PR comment:
  ```bash
  git add screenshots/ && git commit -m "docs: add proof-of-work screenshots" && git push
  SHA=$(git rev-parse HEAD)
  gh pr comment <pr-number> --body "## Screenshots
  ![form](https://github.com/<owner>/<repo>/blob/$SHA/screenshots/proof-form.png?raw=true)
  ![profile](https://github.com/<owner>/<repo>/blob/$SHA/screenshots/proof-profile.png?raw=true)"
  ```
  Use the commit SHA (not the branch name) in the URL to avoid slash-encoding issues.
- Print `FACTORY:PR_CREATED:<pr-url>` on its own line

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

Prompt the reviewer:

```bash
herdr agent prompt "reviewer-<id>" "Review the PR at <pr-url>. Check out the branch, read the diff, and submit your review using gh pr review --comment (NOT --approve or --request-changes, since the PR author token is the same). Focus on correctness, test coverage, and adherence to the existing codebase patterns." --wait --timeout 300000
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
