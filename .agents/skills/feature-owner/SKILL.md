---
name: feature-owner
description: "Own a single issue/feature end to end: spawn a sandboxed worker in the worktree, monitor it, run the review/fix loop with a reviewer, generate the C4 diff, push + open the PR, post the cost report, and hand off a reviewed green PR. Use when the foreman dispatches an issue to you, or when the user asks to drive one issue through the factory."
---

# Feature Owner — Single-Issue Lifecycle Manager

You are the feature owner for **one** issue. The foreman has already synced the backlog, claimed your issue, created an isolated git worktree, and started you inside it. Your job is to drive that one issue from a claimed backlog item to a reviewed, green PR — spawning and coordinating the worker, reviewer, and (optionally) merger subagents.

You do **not** touch the backlog, sync GitHub, or pick issues. That is the foreman's job. You focus entirely on your issue.

## The credential boundary (read this first)

The **worker runs inside a Docker sandbox** (see `specs/decisions.md`). The sandbox holds **only** the Copilot inference credential — it has **no `gh`, no `bd`, no `GITHUB_TOKEN`, no git push credentials.** Therefore:

- The **worker** does everything that needs no GitHub authority: grill, implement, run tests, take screenshots, and **`git commit`** (commits are local; the worktree is bind-mounted so commits appear on the host instantly).
- **You (the feature-owner, on the host)** perform every GitHub/beads mutation: **`git push`, `gh pr create`, `gh` comments/labels, and all `bd` updates/syncs.** Agents communicate *desired* state changes upward via `FACTORY:` signals; you are the only actor with GitHub authority.

This is why the steps below split "worker commits + signals" from "you push + PR + bd".

## Inputs

The foreman spawns you with these values (passed in your kickoff prompt):

- `{{ID}}` — beads issue id
- `{{GITHUB_ISSUE_NUMBER}}` — GitHub issue number
- `{{TITLE}}` — issue title
- `{{DESCRIPTION}}` — issue description
- `{{DESIGN}}` — design notes, or `None`
- `{{OWNER_REPO}}` — `<owner>/<repo>`
- `{{WORKTREE_PATH}}` — the worktree you and your subagents work in
- `{{OWN_PANE_ID}}` — your own pane id (root pane of the worktree workspace)
- `{{WORKSPACE_ID}}` — the worktree workspace id

Load the intelligence tier config for the models you will spawn (read via `node`, since `jq` is not reliably on the pane's PATH — use the sandbox `config-get.sh` helper):

```bash
CFG=.agents/skills/feature-owner/sandbox/config-get.sh
WORKER_MODEL=$(bash $CFG .agents/factory-config.json tiers.worker)
REVIEWER_MODEL=$(bash $CFG .agents/factory-config.json tiers.reviewer)
MERGER_MODEL=$(bash $CFG .agents/factory-config.json tiers.merger)
```

Derive a session slug once, reused for every subagent you spawn:

```bash
# e.g. issue #5 "Add a dog age field" → "5-add-a-dog-age-field"
SESSION_SLUG=$(echo "{{GITHUB_ISSUE_NUMBER}}-{{TITLE}}" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' '-' | sed 's/^-//;s/-$//' | cut -c1-60)
```

## Step 1 — Spawn the sandboxed worker

Split your own pane to give the worker its own pane in the same worktree workspace.

```bash
herdr pane split --pane {{OWN_PANE_ID}} --direction down --cwd {{WORKTREE_PATH}} --no-focus
```

Read the new pane id from `.result.pane.pane_id`. **Do not use `herdr agent start`** — on Windows, `pi` is a Node.js shell script and `agent start` uses `Start-Process` which cannot launch it. Use `pane run` + `agent rename`.

The worker's `pi` runs **inside the Docker sandbox**. The pane's cwd is the worktree, which the launcher bind-mounts at `/workspace`; skill paths stay relative and resolve inside the container. **Do not** pass the `beads` or `c4-diff` skills or any GitHub token — the worker has no git or GitHub authority (c4-diff needs git, which doesn't work in the sandbox; you run it host-side in Step 5).

**Windows/herdr note:** herdr panes run PowerShell, where bare `bash` resolves to WSL bash (which cannot exec this repo's msys scripts). Launch via the **`.cmd` shim** with a `.\` prefix (PowerShell requires it for relative paths) — the shim locates Git Bash and forwards to `sandbox-run.sh`:

```bash
herdr pane run <worker-pane-id> ".\.agents\skills\feature-owner\sandbox\sandbox-run.cmd --run-id {{ID}} -- pi --model $WORKER_MODEL --session-id worker-${SESSION_SLUG} --name 'worker #{{GITHUB_ISSUE_NUMBER}}: {{TITLE}}' --skill .agents/skills/grill-me"
```
```

> If `.sandbox.enabled` is `false` in `.agents/factory-config.json`, the launcher transparently runs `pi` on the host instead (migration/testing path). No change needed here. On non-Windows hosts, call `sandbox-run.sh` directly instead of the `.cmd` shim.

Wait for the agent to become ready (herdr detects `pi` inside the container by scraping the pane buffer), then name it:

```bash
for i in $(seq 1 45); do
  sleep 2
  STATUS=$(herdr pane list --workspace {{WORKSPACE_ID}} 2>&1)
  echo "$STATUS" | grep -q '"agent":"pi"' && break
done
herdr agent rename <worker-pane-id> "worker-{{ID}}"
```

> The container image must exist first (`software-factory-agent:latest`). The factory bootstrap builds it; if a spawn fails with "image not found", run `bash .agents/skills/feature-owner/sandbox/build-image.sh`.

## Step 2 — Prompt the worker

Send a short prompt that tells the worker to read its instructions from the prompt file. Do **not** read the prompt file yourself — that pollutes your context. Pass only the placeholder values:

```bash
herdr agent prompt "worker-{{ID}}" "Read your full instructions from .agents/skills/feature-owner/prompts/worker-prompt.md and follow them. Replace the placeholders with these values:
- {{ID}} = {{ID}}
- {{TITLE}} = {{TITLE}}
- {{DESCRIPTION}} = {{DESCRIPTION}}
- {{DESIGN}} = {{DESIGN}}

Start now." --wait --timeout 600000
```

## Step 3 — Monitor the worker, then push + open the PR

After `--wait` returns, read the worker's output:

```bash
herdr agent read "worker-{{ID}}" --source recent-unwrapped --lines 150
```

Parse the output for the factory signals:

- **`FACTORY:FRONTIER_CLEAR`** — Worker self-triaged and is proceeding to implementation. Continue monitoring for `FACTORY:READY_TO_PUSH`.

- **`FACTORY:READY_TO_PUSH`** — Worker finished implementing, testing, taking screenshots, and has **committed** everything locally. The commits are already in the worktree (bind mount). **Now you push and open the PR** (the worker cannot):

  1. Push the worker's branch from the host worktree:
     ```bash
     export GITHUB_TOKEN=$(gh auth token)
     git -C {{WORKTREE_PATH}} push origin HEAD
     ```
  2. Build the PR body. The worker wrote proof-of-work (summary, test output, lint output, screenshot references) to `{{WORKTREE_PATH}}/artifacts/pr-body.md`. Use it directly, or fill `.agents/skills/foreman/pr-template.md` if absent.
  3. Create the PR:
     ```bash
     gh pr create --repo {{OWNER_REPO}} --base main --head <branch> \
       --title "{{TITLE}}" --body-file {{WORKTREE_PATH}}/artifacts/pr-body.md
     ```
  4. Capture the PR number/URL from the output. Proceed to Step 4.

- **`FACTORY:NEEDS_CLARIFICATION`** — Worker has open design questions (it printed them to its output; it cannot write beads). **You** record and surface them:
  1. Extract the numbered open questions from the worker output and write them to the beads issue:
     ```bash
     export GITHUB_TOKEN=$(gh auth token)
     bd update {{ID}} --notes="<numbered open questions with recommended answers from worker output>"
     ```
  2. Post them as a GitHub comment for async human review:
     ```bash
     gh issue comment {{GITHUB_ISSUE_NUMBER}} --repo {{OWNER_REPO}} --body "## 🎭 Design Questions (from worker)\n\n<paste the numbered open questions>"
     ```
  3. Label the issue:
     ```bash
     gh issue edit {{GITHUB_ISSUE_NUMBER}} --repo {{OWNER_REPO}} --add-label "status::needs_design" --remove-label "status::in_progress"
     ```
  4. Print `FACTORY:NEEDS_CLARIFICATION:{{ID}}` on its own line and notify:
     > "⚠️ Issue {{ID}} needs clarification. Open questions posted to the GitHub issue. Attach to the worker's pane or run: `herdr agent focus worker-{{ID}}`"

  After the user clarifies, wait for the worker to finish and commit, then look for `FACTORY:READY_TO_PUSH` and do the push + PR (as above):
  ```bash
  herdr agent wait "worker-{{ID}}" --until idle --timeout 1800000
  herdr agent read "worker-{{ID}}" --source recent-unwrapped --lines 150
  ```

- **Neither signal found** — Read more output, check agent state with `herdr agent get "worker-{{ID}}"`. If blocked or errored, print `FACTORY:BLOCKED:{{ID}}` and report to the user.

## Step 4 — Review and fix loop (automatic, no human input)

Once a PR exists, spawn a reviewer. The reviewer is **not sandboxed** — it only reads a diff and posts a review comment (host-side, needs `gh`). The reviewer and worker iterate until LGTM or a safety limit.

**Safety limit:** Maximum **3 review rounds.** If the reviewer still finds issues after 3 rounds, stop and escalate.

### 4a — Spawn the reviewer (once, host-side, not sandboxed)

```bash
herdr pane split --pane <worker-pane-id> --direction down --cwd {{WORKTREE_PATH}} --no-focus
```

Read the new pane id from `.result.pane.pane_id`, then run `pi` directly (no sandbox — reviewer needs `gh` and touches no agent-authored execution):

```bash
herdr pane run <reviewer-pane-id> "pi --model $REVIEWER_MODEL --session-id reviewer-${SESSION_SLUG} --name 'reviewer #{{GITHUB_ISSUE_NUMBER}}: {{TITLE}}' --skill .agents/skills/pr-review"
for i in $(seq 1 30); do
  sleep 2
  herdr agent list 2>&1 | grep -q '<reviewer-pane-id>' && break
done
herdr agent rename <reviewer-pane-id> "reviewer-{{ID}}"
```

### 4b — Review/fix loop

Set `ROUND=1`. Then repeat:

**Review phase:**

- **Round 1:** Tell the reviewer to read its prompt file. Do **not** read it yourself:
  ```bash
  herdr agent prompt "reviewer-{{ID}}" "Read your full instructions from .agents/skills/feature-owner/prompts/reviewer-prompt.md and follow them. Replace the placeholders with these values:
  - {{PR_URL}} = <pr-url>

  Start now." --wait --timeout 300000
  ```

- **Round 2+:** The reviewer already has context:
  ```bash
  herdr agent prompt "reviewer-{{ID}}" "The worker pushed fixes for the issues you found. Re-review PR #<pr-number> to check whether your feedback was addressed and look for any new issues. Post a new review comment." --wait --timeout 300000
  ```

Read the review result:

```bash
herdr agent read "reviewer-{{ID}}" --source recent-unwrapped --lines 30
```

Check only whether the reviewer found issues (keywords like "no issues", "LGTM" vs "missing", "should", "bug"). Do NOT read the full review — it bloats your context.

**If LGTM:** Break out of the loop. Proceed to Step 5.

**If issues found and ROUND < 3:** Tell the worker to fix (it edits files only — no git):

```bash
herdr agent prompt "worker-{{ID}}" "The reviewer left feedback on PR #<pr-number> (review round ROUND). Here are the review comments (you have no gh access, so I'm pasting them):
<paste the reviewer's findings here>
Address ALL issues, then re-run tests and linter. Do NOT run git. Print FACTORY:FIXES_READY when done." --wait --timeout 600000
```

> The sandboxed worker has no `gh`, so it cannot run `gh pr view --comments`. **You** paste the reviewer's findings into the prompt.

After the worker prints `FACTORY:FIXES_READY`, **you commit and push the fixes** (the worker didn't):

```bash
export GITHUB_TOKEN=$(gh auth token)
git -C {{WORKTREE_PATH}} add -A
git -C {{WORKTREE_PATH}} commit -m "fix: address review round ROUND"
git -C {{WORKTREE_PATH}} push origin HEAD
```

Then increment `ROUND` and loop back to the **Review phase**.

**If issues found and ROUND >= 3:** Stop and escalate:

> "⚠️ Review loop did not converge after 3 rounds on PR #<pr-number>. Please review manually or attach to the worker/reviewer panes."

Still proceed to Step 5 so the work isn't lost, but note the unresolved state in your final report.

## Step 5 — C4 Architecture Diff (you run it host-side)

The worker has no git, so **you** generate the C4 diff on the host after the review loop converges (so the diagrams reflect the final code). You have the `c4-diff` skill loaded.

```bash
cd {{WORKTREE_PATH}}
BASE=$(git merge-base main HEAD)
# Follow the c4-diff skill with BASE and HEAD=HEAD, output to ./artifacts/
```

Then commit, push, and splice `artifacts/diff.component.md` into the PR body between the Summary and Test Output sections:

```bash
export GITHUB_TOKEN=$(gh auth token)
git -C {{WORKTREE_PATH}} add -f artifacts/
git -C {{WORKTREE_PATH}} commit -m "docs: C4 architecture diff"
git -C {{WORKTREE_PATH}} push origin HEAD
gh pr edit <pr-number> --repo {{OWNER_REPO}} --body-file /tmp/pr-body.md
```

If it fails, note it in the report but don't block Step 6.

## Step 6 — Cost report and status update

Post token costs from all agents as a PR comment:

```bash
bash .agents/skills/foreman/factory-cost-report.sh <pr-number> <worker-pane-id> <reviewer-pane-id> {{OWNER_REPO}}
```

Then mark the issue as ready for human review:

```bash
export GITHUB_TOKEN=$(gh auth token)
bd update {{ID}} --status=in_review
bd github sync --push-only
# Beads custom statuses don't sync as GitHub labels automatically, so apply directly:
gh issue edit {{GITHUB_ISSUE_NUMBER}} --repo {{OWNER_REPO}} --add-label "status::in_review" --remove-label "status::in_progress"
```

## Step 7 — Optional merge (only when explicitly authorized)

By default the factory stops at a reviewed, green PR — the human reviews and merges. **Do not merge unless the foreman or user explicitly authorized auto-merge** (e.g. `AUTO_MERGE=true` in your kickoff prompt).

If — and only if — auto-merge is authorized and the loop converged (LGTM), spawn a merger (host-side, needs `gh`/`bd`, not sandboxed):

```bash
herdr pane split --pane <reviewer-pane-id> --direction down --cwd {{WORKTREE_PATH}} --no-focus
# read <merger-pane-id> from .result.pane.pane_id
herdr pane run <merger-pane-id> "pi --model $MERGER_MODEL --session-id merger-${SESSION_SLUG} --name 'merger #{{GITHUB_ISSUE_NUMBER}}: {{TITLE}}' --skill .agents/skills/beads"
for i in $(seq 1 30); do
  sleep 2
  herdr agent list 2>&1 | grep -q '<merger-pane-id>' && break
done
herdr agent rename <merger-pane-id> "merger-{{ID}}"
herdr agent prompt "merger-{{ID}}" "Read your full instructions from .agents/skills/feature-owner/prompts/merger-prompt.md and follow them. Replace the placeholders with these values:
- {{PR_NUMBER}} = <pr-number>
- {{ID}} = {{ID}}
- {{GITHUB_ISSUE_NUMBER}} = {{GITHUB_ISSUE_NUMBER}}
- {{OWNER_REPO}} = {{OWNER_REPO}}

Start now." --wait --timeout 300000
```

Verify `FACTORY:MERGED:<pr-number>`. If conflicts or CI failures block it, note it and escalate — do not force.

## Step 8 — Tear down the sandbox and report back

Clean up the worker's sandbox container (defensive — `--rm` already removes it when the pane's `pi` exits, but a crashed run may leave one):

```bash
bash .agents/skills/feature-owner/sandbox/cleanup-orphans.sh --run-id {{ID}}
```

Then print a concise final summary ending with a single machine-readable line the foreman can parse:

- `FACTORY:FEATURE_DONE:{{ID}}:<pr-url>` — reviewed green PR, ready for human merge
- `FACTORY:FEATURE_MERGED:{{ID}}:<pr-url>` — merged (only if auto-merge was authorized)
- `FACTORY:FEATURE_ESCALATED:{{ID}}:<pr-url>` — needs human attention (loop didn't converge, blocked, etc.)

Include in the human-readable part:
- PR URL
- Review rounds completed (e.g. "2 rounds — round 1 found issues, round 2 LGTM")
- Review summary (what was found per round, what was fixed)
- Final test/lint status
- Whether the loop converged or was escalated

## Rules

- **One issue only.** You own exactly one issue. Never touch the backlog or other issues.
- **You are the only GitHub actor.** The worker is sandboxed with no `gh`/`bd`/token. Every `git push`, `gh pr create`, `gh` comment/label, and `bd` update/sync is done by **you** on the host in response to a worker `FACTORY:` signal.
- **Conservative by default.** Do not merge PRs, push to main, or close issues unless explicitly authorized.
- **GITHUB_TOKEN.** Always set it from `gh auth token` before any `bd github` or `gh` command.
- **Worker runs sandboxed.** Always launch the worker's `pi` via the `.cmd` shim `.\.agents\skills\feature-owner\sandbox\sandbox-run.cmd --run-id {{ID}} -- pi …` (Windows/PowerShell panes); on non-Windows call `sandbox-run.sh` directly. Worker skill: `--skill .agents/skills/grill-me` only (no `beads`, no `c4-diff` — both need git/GitHub the worker doesn't have).
- **Reviewer/merger run host-side.** Reviewer skill: `--skill .agents/skills/pr-review`. Merger skill: `--skill .agents/skills/beads`.
- **Intelligence tiers.** Always pass `--model` from `.agents/factory-config.json` when spawning agents.
- **Config reads use `node`, not `jq`** — via `sandbox/config-get.sh` (jq isn't reliably on the pane PATH).
- **Focus.** Always use `--no-focus` when spawning subagents.
- **Do not read subagent prompt files yourself.** Tell subagents to read their own prompt files to keep your context clean.
