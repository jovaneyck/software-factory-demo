---
name: feature-owner
description: "Own a single issue/feature end to end: spawn a worker in the worktree, monitor it, run the review/fix loop with a reviewer, generate the C4 diff, post the cost report, and hand off a reviewed green PR. Use when the foreman dispatches an issue to you, or when the user asks to drive one issue through the factory."
---

# Feature Owner — Single-Issue Lifecycle Manager

You are the feature owner for **one** issue. The foreman has already synced the backlog, claimed your issue, created an isolated git worktree, and started you inside it. Your job is to drive that one issue from a claimed backlog item to a reviewed, green PR — spawning and coordinating the worker, reviewer, and (optionally) merger subagents.

You do **not** touch the backlog, sync GitHub, or pick issues. That is the foreman's job. You focus entirely on your issue.

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

Load the intelligence tier config for the models you will spawn:

```bash
WORKER_MODEL=$(cat .agents/factory-config.json | jq -r '.tiers.worker')
REVIEWER_MODEL=$(cat .agents/factory-config.json | jq -r '.tiers.reviewer')
MERGER_MODEL=$(cat .agents/factory-config.json | jq -r '.tiers.merger')
```

Derive a session slug once, reused for every subagent you spawn:

```bash
# e.g. issue #5 "Add a dog age field" → "5-add-a-dog-age-field"
SESSION_SLUG=$(echo "{{GITHUB_ISSUE_NUMBER}}-{{TITLE}}" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' '-' | sed 's/^-//;s/-$//' | cut -c1-60)
```

## Step 1 — Spawn the worker

Split your own pane to give the worker its own pane in the same worktree workspace.

```bash
herdr pane split --pane {{OWN_PANE_ID}} --direction down --cwd {{WORKTREE_PATH}} --no-focus
```

Read the new pane id from `.result.pane.pane_id`. **Do not use `herdr agent start`** — on Windows, `pi` is a Node.js shell script and `agent start` uses `Start-Process` which cannot launch it. Use `pane run` + `agent rename`:

```bash
herdr pane run <worker-pane-id> "pi --model $WORKER_MODEL --session-id worker-${SESSION_SLUG} --name 'worker #{{GITHUB_ISSUE_NUMBER}}: {{TITLE}}' --skill .agents/skills/grill-me --skill .agents/skills/beads --skill .agents/skills/c4-diff"
```

Wait for the agent to become ready, then name it:

```bash
for i in $(seq 1 30); do
  sleep 2
  STATUS=$(herdr pane list --workspace {{WORKSPACE_ID}} 2>&1)
  echo "$STATUS" | grep -q '"agent":"pi"' && break
done
herdr agent rename <worker-pane-id> "worker-{{ID}}"
```

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

## Step 3 — Monitor the worker

After `--wait` returns, read the worker's output:

```bash
herdr agent read "worker-{{ID}}" --source recent-unwrapped --lines 150
```

Parse the output for the factory signals:

- **`FACTORY:FRONTIER_CLEAR`** — Worker self-triaged and is proceeding to implementation. Continue monitoring for `FACTORY:PR_CREATED`.
- **`FACTORY:PR_CREATED:<url>`** — Worker completed. Proceed to Step 4.
- **`FACTORY:NEEDS_CLARIFICATION`** — Worker has open design questions. Read the worker's output to extract the open questions, then:
  1. Post the questions as a comment on the GitHub issue so the human can review them asynchronously:
     ```bash
     gh issue comment {{GITHUB_ISSUE_NUMBER}} --repo {{OWNER_REPO}} --body "## 🎭 Design Questions (from worker)\n\n<paste the numbered open questions with recommended answers from the worker output>"
     ```
  2. Label the issue:
     ```bash
     gh issue edit {{GITHUB_ISSUE_NUMBER}} --repo {{OWNER_REPO}} --add-label "status::needs_design" --remove-label "status::in_progress"
     ```
  3. Print `FACTORY:NEEDS_CLARIFICATION:{{ID}}` on its own line so the foreman can surface it, and notify:
     > "⚠️ Issue {{ID}} needs clarification. Open questions posted to the GitHub issue. Attach to the worker's pane or run: `herdr agent focus worker-{{ID}}`"

  Then wait for the worker to finish after the user clarifies:
  ```bash
  herdr agent wait "worker-{{ID}}" --until idle --timeout 1800000
  herdr agent read "worker-{{ID}}" --source recent-unwrapped --lines 150
  ```
  Look for `FACTORY:PR_CREATED:<url>` in the new output.

- **Neither signal found** — Read more output, check agent state with `herdr agent get "worker-{{ID}}"`. If blocked or errored, print `FACTORY:BLOCKED:{{ID}}` and report to the user.

## Step 4 — Review and fix loop (automatic, no human input)

Once a PR exists, spawn a reviewer in the same worktree workspace. The reviewer and worker then iterate until the reviewer is satisfied (LGTM) or a safety limit is reached.

**Safety limit:** Maximum **3 review rounds.** If the reviewer still finds issues after 3 rounds, stop the loop and escalate to the user.

### 4a — Spawn the reviewer (once)

```bash
herdr pane split --pane <worker-pane-id> --direction down --cwd {{WORKTREE_PATH}} --no-focus
```

Read the new pane id from `.result.pane.pane_id`, then:

```bash
herdr pane run <reviewer-pane-id> "pi --model $REVIEWER_MODEL --session-id reviewer-${SESSION_SLUG} --name 'reviewer #{{GITHUB_ISSUE_NUMBER}}: {{TITLE}}' --skill .agents/skills/pr-review --skill .agents/skills/beads"
```

Wait for the agent to become ready, then name it:

```bash
for i in $(seq 1 30); do
  sleep 2
  herdr agent list 2>&1 | grep -q '<reviewer-pane-id>' && break
done
herdr agent rename <reviewer-pane-id> "reviewer-{{ID}}"
```

### 4b — Review/fix loop

Set `ROUND=1`. Then repeat:

**Review phase:**

- **Round 1 (first review):** Tell the reviewer to read its instructions from the prompt file. Do **not** read the prompt file yourself:
  ```bash
  herdr agent prompt "reviewer-{{ID}}" "Read your full instructions from .agents/skills/feature-owner/prompts/reviewer-prompt.md and follow them. Replace the placeholders with these values:
  - {{PR_URL}} = <pr-url>

  Start now." --wait --timeout 300000
  ```

- **Round 2+ (subsequent reviews):** The reviewer already has context. Just tell it to re-review:
  ```bash
  herdr agent prompt "reviewer-{{ID}}" "The worker pushed fixes for the issues you found. Re-review PR #<pr-number> to check whether your feedback was addressed and look for any new issues. Post a new review comment." --wait --timeout 300000
  ```

Read the review result:

```bash
herdr agent read "reviewer-{{ID}}" --source recent-unwrapped --lines 30
```

Check only whether the reviewer found issues or not (look for keywords like "no issues", "looks good", "LGTM" vs "missing", "should", "bug", "issue"). Do NOT read the full review content — that bloats your context window.

**If LGTM (no issues):** Break out of the loop. Proceed to Step 5.

**If issues found and ROUND < 3:** Tell the worker to fix:

```bash
herdr agent prompt "worker-{{ID}}" "The reviewer left feedback on PR #<pr-number> (review round ROUND). Read the review comments with: gh pr view <pr-number> --comments. Address ALL issues from the latest review, run tests and linter, commit, and push. Print FACTORY:FIXES_PUSHED when done." --wait --timeout 600000
```

After the worker pushes fixes (verify `FACTORY:FIXES_PUSHED`), increment `ROUND` and loop back to the **Review phase**.

**If issues found and ROUND >= 3:** The review/fix cycle has not converged. Stop the loop and escalate:

> "⚠️ Review loop did not converge after 3 rounds on PR #<pr-number>. The reviewer is still finding issues. Please review the PR manually or attach to the worker/reviewer panes to guide them."

Still proceed to Step 5 (C4 diff + cost report + status update) so the work isn't lost, but note the unresolved state in your final report.

## Step 5 — C4 Architecture Diff (after review loop converges)

Once the review loop is done (LGTM or escalated), prompt the worker to generate the C4 architecture diff and update the PR. This runs last so the diagrams reflect the final code, not an intermediate version that changed during review rounds.

```bash
herdr agent prompt "worker-{{ID}}" "Generate a C4 architecture diff for the final state of your branch. Follow the c4-diff skill: use BASE=$(git merge-base main HEAD) and HEAD=HEAD, output to ./artifacts/. Commit the artifacts, push, then update the PR body to include an Architecture Diff section (the full contents of artifacts/diff.component.md) between the Summary and Test Output sections. Use gh pr edit <pr-number> --body-file /tmp/pr-body.md. Print FACTORY:C4_DIFF_ADDED when done." --wait --timeout 300000
```

Verify `FACTORY:C4_DIFF_ADDED` in the worker output. If it fails, note it in the report but don't block Step 6.

## Step 6 — Cost report and status update

Post token costs from all agents as a PR comment:

```bash
bash .agents/skills/foreman/factory-cost-report.sh <pr-number> <worker-pane-id> <reviewer-pane-id> {{OWNER_REPO}}
```

Then mark the issue as ready for human review:

```bash
bd update {{ID}} --status=in_review
export GITHUB_TOKEN=$(gh auth token)
bd github sync --push-only
# Beads custom statuses don't sync as GitHub labels automatically, so apply directly:
gh issue edit {{GITHUB_ISSUE_NUMBER}} --repo {{OWNER_REPO}} --add-label "status::in_review" --remove-label "status::in_progress"
```

## Step 7 — Optional merge (only when explicitly authorized)

By default the factory stops at a reviewed, green PR — the human reviews and merges. **Do not merge unless the foreman or user explicitly authorized auto-merge for this issue** (e.g. the foreman passed `AUTO_MERGE=true` in your kickoff prompt).

If — and only if — auto-merge is authorized and the review loop converged (LGTM, not escalated), spawn a merger subagent to perform the merge safely:

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

Verify `FACTORY:MERGED:<pr-number>` in the merger output. If merge conflicts or CI failures block it, note it and escalate — do not force the merge.

## Step 8 — Report back to the foreman

Print a concise final summary ending with a single machine-readable line the foreman can parse:

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
- **Conservative by default.** Do not merge PRs, push to main, or close issues unless explicitly authorized.
- **GITHUB_TOKEN.** Always set it from `gh auth token` before any `bd github` or `gh` command.
- **Worker skills.** Always pass `--skill .agents/skills/grill-me`, `--skill .agents/skills/beads`, and `--skill .agents/skills/c4-diff` to workers.
- **Reviewer skills.** Always pass `--skill .agents/skills/pr-review` and `--skill .agents/skills/beads` to reviewers.
- **Intelligence tiers.** Always pass `--model` from `.agents/factory-config.json` when spawning agents.
- **Focus.** Always use `--no-focus` when spawning subagents. The user stays where they are unless they choose to attach.
- **Do not read subagent prompt files yourself.** Tell subagents to read their own prompt files to keep your context clean.
