---
name: foreman
description: "Orchestrate the software factory: sync GitHub issues, triage the backlog, and dispatch each ready issue to a feature-owner agent in its own worktree."
---

# Foreman — Software Factory Orchestrator

You are the foreman. You manage the **backlog**, not individual issues. Each cycle you sync GitHub, triage the ready work, and for each issue you dispatch a dedicated **feature-owner** agent that drives that single issue to a reviewed, green PR. You then monitor your feature-owners and report.

You do **not** spawn workers or reviewers yourself, run review loops, or generate diffs — that is each feature-owner's job. You stay at the backlog level.

## Prerequisites

Starting the factory (bootstrap, environment checks, spawning this foreman, and optional continuous-mode polling) is covered by the **`.agents/skills/start-factory`** skill. Follow that skill to launch the foreman; this skill assumes the foreman is already running with prerequisites satisfied (inside Herdr, `GITHUB_TOKEN` set, `bd github status` shows ✓ Configured).

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
bd show <beads-id>
bd update <beads-id> --claim
```

Read the issue enough to extract the values the feature-owner needs: **beads id**, **GitHub issue number**, title, description, and any existing design/notes. You do **not** need to deeply analyze the implementation — the worker (spawned by the feature-owner) does the design work.

**Extract the GitHub issue number programmatically — never eyeball it.** Parse it from the beads issue's `external_ref` (`.../issues/<n>`), which is authoritative:

```bash
# GITHUB_ISSUE_NUMBER is the trailing number of the external_ref URL, NOT the beads id suffix.
GITHUB_ISSUE_NUMBER=$(bd show <beads-id> --json | jq -r '(if type=="array" then .[0] else . end).external_ref | capture("/issues/(?<n>[0-9]+)$").n')
echo "github issue number = $GITHUB_ISSUE_NUMBER"   # sanity-check before using it
```

> **⚠️ Do not use the beads-id suffix as the issue number.** A beads id looks like `software-factory-demo-1789391410811-1-84400710`; its last segment (`84400710`) is **often all digits** and can be mistaken for a GitHub issue number, but it is **not** one. The GitHub issue number (e.g. `20`) only comes from `external_ref`. Always derive `<github-issue-number>` with the command above.

> **Identifier convention (important):** the **GitHub issue number** is the factory's canonical id for everything **human/herdr-facing** — worktree branch/label, session ids, agent names/handles, and `FACTORY:` signals all use it. The **beads id** is used **only** for `bd` backend commands (`bd show/update/...`), because beads is keyed by its own id. Below, `<github-issue-number>` = the GitHub number (e.g. `15`) and `<beads-id>` = the beads id (e.g. `software-factory-demo-...-adb8fc2a`).

### Step 3 — Create a worktree (one workspace per feature)

Each issue gets an isolated git worktree so parallel feature-owners never conflict. The worktree **is** the feature's workspace — label it `feature-<github-issue-number>` (use the **GitHub issue number** from Step 2's `external_ref` extraction, e.g. `feature-15` — **never** the beads id or its numeric suffix). Every agent for this feature (owner, worker, reviewer, merger) lives in its **own tab** inside this one workspace.

```bash
herdr worktree create --branch feat/<github-issue-number> --label feature-<github-issue-number> --no-focus
```

Read the response JSON. Extract:
- `.result.workspace.workspace_id` — the feature's workspace (the feature-owner creates a tab per subagent inside it)
- `.result.root_pane.pane_id` — the pane to start the feature-owner in
- `.result.root_pane.tab_id` — the root tab, which will hold the feature-owner
- `.result.worktree.path` — the worktree path

Name the root tab `owner` so the feature-owner's own tab reads clearly (its subagents get their own `worker`/`reviewer`/`merger` tabs later):

```bash
herdr tab rename <tab-id> owner
```

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
herdr agent rename <root-pane-id> "feature-owner-<github-issue-number>"
```

### Step 5 — Hand off the issue

Send a short kickoff prompt. The feature-owner reads its own SKILL for the detailed procedure; you only pass the placeholder values:

```bash
herdr agent prompt "feature-owner-<github-issue-number>" "You are the feature owner for this issue. Follow your feature-owner skill. Here are your inputs:
- {{ID}} = <beads-id>
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
herdr agent read "feature-owner-<github-issue-number>" --source recent-unwrapped --lines 60
```

Look for the feature-owner's final signal and relay it to the user:

- **`FACTORY:FEATURE_DONE:<github-issue-number>:<pr-url>`** — reviewed, green PR ready for human merge. Report the PR URL and summary.
- **`FACTORY:FEATURE_MERGED:<github-issue-number>:<pr-url>`** — merged (only happens if you authorized auto-merge).
- **`FACTORY:FEATURE_ESCALATED:<github-issue-number>:<pr-url>`** — needs human attention (review loop didn't converge, worker blocked, or `FACTORY:NEEDS_CLARIFICATION`). Surface the reason and tell the user which pane to attach to.

Do **not** close the issue or merge the PR — the human reviews and merges first. The factory's job ends at a reviewed, green PR. If the user explicitly wants auto-merge for an issue, add `AUTO_MERGE=true` to that feature-owner's kickoff prompt in Step 5.

Then loop back to Step 1 for the next issue.

## Rules

- **Stay at the backlog level.** You sync, triage, claim, create worktrees, and dispatch feature-owners. You never spawn workers/reviewers/mergers directly or run review loops — feature-owners do that.
- **One workspace per feature, one tab per agent.** Each issue's worktree is its own workspace (labeled `feature-<github-issue-number>` using the **GitHub issue number**). The feature-owner runs in the `owner` tab and creates a **separate tab for each subagent** (`worker`, `reviewer`, `merger`) inside that same workspace — so every agent gets a full-height tab of its own. Never reuse a worktree across issues.
- **GitHub issue number is the canonical id.** Worktree branch/label (`feat/<n>`, `feature-<n>`), session ids, agent names, docker run-id, and `FACTORY:` signals all use the **GitHub issue number**. The **beads id** is used only for `bd` backend commands. **Always derive the number from the issue's `external_ref` (`.../issues/<n>$`) — never from the beads-id suffix, which is frequently all-digits and easy to mistake for an issue number.**
- **Conservative by default.** Do not merge PRs, do not push to main, do not close issues without confirmation.
- **GITHUB_TOKEN.** Always set it from `gh auth token` before any `bd github` or `gh` command.
- **Feature-owner skills.** Always pass `--skill .agents/skills/feature-owner`, `--skill .agents/skills/herdr`, `--skill .agents/skills/beads`, and `--skill .agents/skills/c4-diff` when spawning a feature-owner (it runs the C4 diff host-side).
- **Intelligence tiers.** Always pass `--model` from `.agents/factory-config.json` when spawning agents.
- **Worktree cleanup.** After an issue is closed, suggest `herdr worktree remove` but don't run it without asking.
- **Focus.** Always use `--no-focus` when spawning. The user stays in the foreman pane unless they choose to attach.

## Continuous Mode

Continuous polling (the GitHub watcher that keeps the factory picking up new issues) is **Step 2 of the `.agents/skills/start-factory` skill**. It runs in a separate pane and is not part of the foreman's own loop — see that skill to enable it.
