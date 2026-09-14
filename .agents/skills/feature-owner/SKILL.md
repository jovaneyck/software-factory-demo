---
name: feature-owner
description: "Own a single issue/feature end to end: spawn a sandboxed worker in the worktree, monitor it, run the review/fix loop with a reviewer, generate the C4 diff, push + open the PR, post the cost report, and hand off a reviewed green PR. Use when the foreman dispatches an issue to you, or when the user asks to drive one issue through the factory."
---

# Feature Owner — Single-Issue Lifecycle Manager

You are the feature owner for **one** issue. The foreman has already synced the backlog, claimed your issue, created an isolated git worktree, and started you inside it. Your job is to drive that one issue from a claimed backlog item to a reviewed, green PR — spawning and coordinating the worker, reviewer, and (optionally) merger subagents.

You do **not** touch the backlog, sync GitHub, or pick issues. That is the foreman's job. You focus entirely on your issue.

## The credential boundary (read this first)

The **worker runs inside a Docker sandbox** (see `specs/decisions.md`). The sandbox holds **only** the inference credential — it has **no `gh`, no `bd`, no `GITHUB_TOKEN`, no git push credentials.** Therefore:

- The **worker** does everything that needs no GitHub authority: grill, implement, run tests, take screenshots, and **`git commit`** (commits are local; the worktree is bind-mounted so commits appear on the host instantly).
- **You (the feature-owner, on the host)** perform every GitHub/beads mutation: **`git push`, `gh pr create`, `gh` comments/labels, and all `bd` updates/syncs.** Agents communicate *desired* state changes upward via `FACTORY:` signals; you are the only actor with GitHub authority.

This is why the steps below split "worker commits + signals" from "you push + PR + bd".

## Inputs

The foreman spawns you with these values (passed in your kickoff prompt):

- `{{ID}}` — beads issue id (used **only** for `bd` backend commands)
- `{{GITHUB_ISSUE_NUMBER}}` — GitHub issue number (the **canonical id** for everything human/herdr-facing: worktree, session ids, agent names/handles, docker run-id, `FACTORY:` signals)
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

### Pin this worktree's git identity to the factory bot (do this once, now)

Every commit and push you make below must be attributed to the **factory bot account** (the one `gh` is authenticated as) — **not** the human's personal git identity. Run the identity helper once against your worktree before any git work:

```bash
bash .agents/skills/foreman/factory-git-identity.sh {{WORKTREE_PATH}}
```

This scopes the bot's `user.name`/`user.email` and a `gh`-based push credential to **this worktree only** (via `extensions.worktreeConfig`); the host's global git config and personal identity are left untouched. Your `git commit`/`git push` commands in the steps below then automatically author, commit, and authenticate as the bot with no extra flags.

## Step 1 — Spawn the sandboxed worker

Create a **new tab** in your feature's workspace so the worker gets its own full-height tab (labeled `worker`), rather than sharing your pane. Every subagent you spawn gets its own tab inside `{{WORKSPACE_ID}}` this way.

```bash
herdr tab create --workspace {{WORKSPACE_ID}} --cwd {{WORKTREE_PATH}} --label worker --no-focus
```

Read the new pane id from `.result.root_pane.pane_id`. **Do not use `herdr agent start`** — on Windows, `pi` is a Node.js shell script and `agent start` uses `Start-Process` which cannot launch it. Use `pane run` + `agent rename`.

The worker's `pi` runs **inside the Docker sandbox**. The pane's cwd is the worktree, which the launcher bind-mounts at `/workspace`; skill paths stay relative and resolve inside the container. **Do not** pass the `beads` or `c4-diff` skills or any GitHub token — the worker has no git or GitHub authority (c4-diff needs git, which doesn't work in the sandbox; you run it host-side in Step 5).

**Windows/herdr note:** herdr panes run PowerShell, where bare `bash` resolves to WSL bash (which cannot exec this repo's msys scripts). Launch via the **`.cmd` shim** with a `.\` prefix (PowerShell requires it for relative paths) — the shim locates Git Bash and forwards to `sandbox-run.sh`:

```bash
herdr pane run <worker-pane-id> ".\.agents\skills\feature-owner\sandbox\sandbox-run.cmd --run-id {{GITHUB_ISSUE_NUMBER}} -- pi --model $WORKER_MODEL --session-id worker-${SESSION_SLUG} --name 'worker #{{GITHUB_ISSUE_NUMBER}}: {{TITLE}}' --skill .agents/skills/grill-me"
```
```

> If `.sandbox.enabled` is `false` in `.agents/factory-config.json`, the launcher transparently runs `pi` on the host instead (migration/testing path). No change needed here. On non-Windows hosts, call `sandbox-run.sh` directly instead of the `.cmd` shim.

Wait for `pi` to boot inside the container. **Important — sandboxed workers are driven by `pane` commands, not `agent` commands.** On Windows, herdr's process-based detection sees the `docker` wrapper, not `pi`, so it never classifies the worker as an agent (`herdr agent prompt/read/rename/wait` will NOT work on it). This is cosmetic — the worker still runs and is fully controllable via `pane run` / `pane wait-output` / `pane read` / `pane send-keys`, which work through the container. Use the **worker's pane id** as the handle everywhere (there is no `worker-{{GITHUB_ISSUE_NUMBER}}` agent name).

Wait for readiness by matching pi's startup banner in the pane buffer:

```bash
herdr pane wait-output <worker-pane-id> --match "pi v" --timeout 120000
```

> The container image must exist first (`software-factory-agent:latest`). The factory bootstrap builds it; if a spawn fails with "image not found", run `bash .agents/skills/feature-owner/sandbox/build-image.sh`.

## Step 2 — Prompt the worker

Send a short prompt that tells the worker to read its instructions from the prompt file. Do **not** read the prompt file yourself — that pollutes your context. `pane run` types the text into pi's TUI and submits it:

```bash
herdr pane run <worker-pane-id> "Read your full instructions from .agents/skills/feature-owner/prompts/worker-prompt.md and follow them. Replace the placeholders with these values: {{ID}} = {{ID}} | {{TITLE}} = {{TITLE}} | {{DESCRIPTION}} = {{DESCRIPTION}} | {{DESIGN}} = {{DESIGN}}. Start now."
```

Then wait for the worker to reach a decision/handoff signal (see Step 3) with `pane wait-output`.

## Step 3 — Monitor the worker, then push + open the PR

Block until the worker emits a factory signal, then read the surrounding output:

```bash
herdr pane wait-output <worker-pane-id> --regex "FACTORY:(READY_TO_PUSH|NEEDS_CLARIFICATION|FRONTIER_CLEAR|BLOCKED)" --timeout 1800000
herdr pane read <worker-pane-id> --source recent-unwrapped --lines 150
```

Parse the output for the factory signals:

- **`FACTORY:FRONTIER_CLEAR`** — Worker self-triaged and is proceeding to implementation. Continue monitoring for `FACTORY:READY_TO_PUSH`.

- **`FACTORY:READY_TO_PUSH`** — Worker finished implementing, testing, and taking screenshots. It has **no git**, so its files (edits + `artifacts/screenshots/`) are in the bind-mounted worktree but **uncommitted**. **Now you commit, push, and open the PR** (the worker cannot):

  1. Commit the worker's work and push from the host worktree. The worker has **no git**, so its edited/created files (including screenshots under `artifacts/screenshots/`) are sitting in the bind-mounted worktree **uncommitted** — you commit them. Use `-A` plus a forced add of `artifacts/` so nothing is missed (screenshots must be force-added in case a stray ignore rule matches):
     ```bash
     export GITHUB_TOKEN=$(gh auth token)
     git -C {{WORKTREE_PATH}} add -A
     git -C {{WORKTREE_PATH}} add -f artifacts/screenshots/ 2>/dev/null || true
     git -C {{WORKTREE_PATH}} commit -q -m "{{TITLE}}" || echo "(nothing to commit — worker may have committed already)"
     git -C {{WORKTREE_PATH}} push origin HEAD
     SHA=$(git -C {{WORKTREE_PATH}} rev-parse HEAD)
     ```
     Sanity-check that any screenshots are now tracked (untracked = they will 404 on GitHub):
     ```bash
     git -C {{WORKTREE_PATH}} ls-files artifacts/screenshots/
     ```
  2. **Assemble the final PR body with the deterministic script — do NOT hand-edit screenshot links.** The worker's `artifacts/pr-body.md` references screenshots by *plain text paths that are frequently wrong* (wrong dir, wrong filename) and never render. Past runs shipped broken `screenshots/proof.png` text and 404s because this was done by hand. Instead, run the assembler, which ignores the worker's text and enumerates the screenshots **actually committed** under `artifacts/screenshots/`, turning each into a commit-pinned, rendered image link (and later splices the C4 diff — absent now, added in Step 5):
     ```bash
     PR_BODY=$(node .agents/skills/foreman/factory-pr-body.js \
       --worktree {{WORKTREE_PATH}} --sha $SHA --repo {{OWNER_REPO}})
     ```
     `$PR_BODY` is the path to the finished body. The script prints to stderr how many screenshots it embedded — **confirm the count matches how many screens the change touched** (a multi-screen change showing only 1 image means the worker under-captured; relay that back as a fix). If the worker wrote "N/A — backend-only change" and no screenshots are committed, the section is left as-is.
  3. Create the PR:
     ```bash
     gh pr create --repo {{OWNER_REPO}} --base main --head <branch> \
       --title "{{TITLE}}" --body-file "$PR_BODY"
     ```
  4. Capture the PR number/URL from the output. Proceed to Step 4.

- **`FACTORY:NEEDS_CLARIFICATION`** — Worker has open design questions (it printed them to its output; it cannot write beads). **You** record and surface them:
  1. Extract the numbered open questions from the worker output and write them to the beads issue:
     ```bash
     export GITHUB_TOKEN=$(gh auth token)
     bd update {{ID}} --notes="<numbered open questions with recommended answers from worker output>"
     ```
  2. Post them as a GitHub comment for async human review, and record the moment you asked so you only pick up **newer** replies:
     ```bash
     ASKED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)
     gh issue comment {{GITHUB_ISSUE_NUMBER}} --repo {{OWNER_REPO}} --body "## 🎭 Design Questions (from worker)\n\nPlease answer inline (quote each question or number your answers) in a reply comment on this issue — the feature-owner is polling and will relay your answers to the worker automatically.\n\n<paste the numbered open questions>"
     ```
  3. Label the issue:
     ```bash
     gh issue edit {{GITHUB_ISSUE_NUMBER}} --repo {{OWNER_REPO}} --add-label "status::needs_design" --remove-label "status::in_progress"
     ```
  4. Print `FACTORY:NEEDS_CLARIFICATION:{{GITHUB_ISSUE_NUMBER}}` on its own line and notify:
     > "⚠️ Issue #{{GITHUB_ISSUE_NUMBER}} needs clarification. Open questions posted to GitHub issue #{{GITHUB_ISSUE_NUMBER}}. Reply there and I'll relay your answers to the worker automatically — no need to attach to the worker pane. (To answer directly instead: `herdr pane focus <worker-pane-id>`.)"

  5. **Wait for the human's answer on either channel** — GitHub *or* the worker pane. Don't assume the human uses GitHub: they may instead attach to the worker pane and answer pi interactively. So each poll iteration checks **both** the GitHub issue comments **and** the worker pane's output, and whichever fires first wins. Poll every 30s, up to ~1 hour:
     ```bash
     export GITHUB_TOKEN=$(gh auth token)
     ME=$(gh api user --jq '.login')
     ANSWER=""          # set if the human answered via GitHub
     RESOLUTION=""       # one of: github_answer | worker_ready | worker_reclarify | timeout
     for i in $(seq 1 120); do
       # (a) Did the worker already move on? (human answered directly in the worker pane)
       PANE_OUT=$(herdr pane read <worker-pane-id> --source recent-unwrapped --lines 80 2>&1)
       if echo "$PANE_OUT" | grep -q "FACTORY:READY_TO_PUSH"; then
         RESOLUTION="worker_ready"; break
       fi
       if echo "$PANE_OUT" | grep -q "FACTORY:NEEDS_CLARIFICATION"; then
         # A *new* clarification after our ASKED_AT means the worker asked again
         RESOLUTION="worker_reclarify"; break
       fi
       # (b) Did the human answer on GitHub? Newest human comment newer than ASKED_AT, not authored by us.
       ANSWER=$(gh issue view {{GITHUB_ISSUE_NUMBER}} --repo {{OWNER_REPO}} \
         --json comments \
         --jq "[.comments[] | select(.createdAt > \"$ASKED_AT\") | select(.author.login != \"$ME\") | .body] | last // empty")
       if [ -n "$ANSWER" ]; then
         RESOLUTION="github_answer"; break
       fi
       sleep 30
     done
     [ -z "$RESOLUTION" ] && RESOLUTION="timeout"
     ```
     Then branch on `RESOLUTION`:
     - **`github_answer`** — the human answered on GitHub. **Relay it to the worker** (the worker has no `gh`, so you paste it in), flip the label back, then wait for the worker to finish:
       ```bash
       herdr pane run <worker-pane-id> "The human answered your open design questions on the GitHub issue. Here are their answers (you have no gh access, so I'm pasting them verbatim):\n\n$ANSWER\n\nIncorporate these answers, continue implementation, and print FACTORY:READY_TO_PUSH when done (or FACTORY:NEEDS_CLARIFICATION again if anything is still ambiguous)."
       gh issue edit {{GITHUB_ISSUE_NUMBER}} --repo {{OWNER_REPO}} --add-label "status::in_progress" --remove-label "status::needs_design"
       ```
     - **`worker_ready`** — the human answered **directly in the worker pane** and the worker is already done. Do **not** relay anything (there's nothing to paste, and the worker has moved on). Just flip the label back and proceed straight to the push/PR step below:
       ```bash
       gh issue edit {{GITHUB_ISSUE_NUMBER}} --repo {{OWNER_REPO}} --add-label "status::in_progress" --remove-label "status::needs_design"
       ```
     - **`worker_reclarify`** — the worker raised *new* open questions. Repeat this whole clarification sub-flow from step 1 (re-extract questions, re-post to GitHub, reset `ASKED_AT`, poll again).
     - **`timeout`** — no answer on either channel within the hour. Leave the `status::needs_design` label in place, print `FACTORY:NEEDS_CLARIFICATION:{{GITHUB_ISSUE_NUMBER}}` again, and tell the user the questions are still waiting on the GitHub issue (they can answer there later, or attach to the worker pane).

  After the answer is handled (`github_answer` or `worker_ready`), wait for `FACTORY:READY_TO_PUSH` and do the commit + push + PR (as above). If `RESOLUTION` was already `worker_ready`, the signal is present and this returns immediately:
  ```bash
  herdr pane wait-output <worker-pane-id> --match "FACTORY:READY_TO_PUSH" --timeout 1800000
  herdr pane read <worker-pane-id> --source recent-unwrapped --lines 150
  ```

- **Neither signal found** — Read more output with `herdr pane read <worker-pane-id> --source recent-unwrapped --lines 200`. If the container has exited unexpectedly (`docker ps` shows no `factory-{{GITHUB_ISSUE_NUMBER}}`), print `FACTORY:BLOCKED:{{GITHUB_ISSUE_NUMBER}}` and report to the user.

## Step 4 — Review and fix (single round, automatic, no human input)

Once a PR exists, spawn a reviewer. The reviewer is **not sandboxed** — it only reads a diff and posts a review comment (host-side, needs `gh`). The reviewer runs **exactly once**; if it finds issues, the worker gets **one** fix pass. There is **no re-review loop**.

**Policy:** **Single review round.** The reviewer reviews once. Any issues it finds get one worker fix pass, then you proceed to Step 5 — the reviewer does **not** re-review. If issues were found, note them (and whether the fix pass addressed them) in your final report so the human can judge on merge.

### 4a-prep — Regenerate host-side dependency shims (Windows sandbox/host mismatch)

The worker installed dependencies **inside the Linux Docker sandbox**, so `node_modules/.bin/` contains only Unix symlinks (e.g. `vitest -> ../vitest/vitest.mjs`) — **no `.cmd`/`.ps1` shims**. The reviewer runs **host-side on Windows**, where `npm test`/`npm run build` shell out via `cmd.exe`, which can only launch `*.cmd` shims. Without this step the reviewer hits `'vitest' is not recognized` and cannot actually run tests/build (it would review blind).

Run a host-side `npm install` in each JS package the reviewer will test, **before** spawning the reviewer. This regenerates the Windows shims against the already-present packages (fast — nothing new to download):

```bash
# For each package with a package.json + tests (e.g. app/frontend). Adjust paths to the repo.
for pkg in app/frontend; do
  if [ -f "{{WORKTREE_PATH}}/$pkg/package.json" ]; then
    (cd "{{WORKTREE_PATH}}/$pkg" && npm install --no-audit --no-fund) || echo "WARN: npm install failed in $pkg"
  fi
done
```

> This only rewrites `.bin` shims; it does not touch source. If the repo has no JS packages, skip this step. On non-Windows hosts it's a harmless no-op (the Unix symlinks already work).

### 4a — Spawn the reviewer (once, host-side, not sandboxed)

```bash
herdr tab create --workspace {{WORKSPACE_ID}} --cwd {{WORKTREE_PATH}} --label reviewer --no-focus
```

Read the new pane id from `.result.root_pane.pane_id`, then run `pi` directly (no sandbox — reviewer needs `gh` and touches no agent-authored execution):

```bash
herdr pane run <reviewer-pane-id> "pi --model $REVIEWER_MODEL --session-id reviewer-${SESSION_SLUG} --name 'reviewer #{{GITHUB_ISSUE_NUMBER}}: {{TITLE}}' --skill .agents/skills/pr-review"
for i in $(seq 1 30); do
  sleep 2
  herdr agent list 2>&1 | grep -q '<reviewer-pane-id>' && break
done
herdr agent rename <reviewer-pane-id> "reviewer-{{GITHUB_ISSUE_NUMBER}}"
```

### 4b — Single review + optional fix

**Review phase (once):** Tell the reviewer to read its prompt file. Do **not** read it yourself:
```bash
herdr agent prompt "reviewer-{{GITHUB_ISSUE_NUMBER}}" "Read your full instructions from .agents/skills/feature-owner/prompts/reviewer-prompt.md and follow them. Replace the placeholders with these values:
- {{PR_URL}} = <pr-url>

Start now." --wait --timeout 300000
```

Read the review result:

```bash
herdr agent read "reviewer-{{GITHUB_ISSUE_NUMBER}}" --source recent-unwrapped --lines 30
```

Check only whether the reviewer found issues (keywords like "no issues", "LGTM" vs "missing", "should", "bug"). Do NOT read the full review — it bloats your context.

**If LGTM:** Proceed to Step 5.

**If issues found:** Run **one** worker fix pass (the worker edits files only — no git):

```bash
herdr pane run <worker-pane-id> "The reviewer left feedback on PR #<pr-number>. Here are the review comments (you have no gh access, so I'm pasting them): <paste the reviewer's findings here>. Address ALL issues, then re-run tests and linter. Do NOT run git. Print FACTORY:FIXES_READY when done."
herdr pane wait-output <worker-pane-id> --match "FACTORY:FIXES_READY" --timeout 600000
```

> The sandboxed worker has no `gh`, so it cannot run `gh pr view --comments`. **You** paste the reviewer's findings into the prompt.

After the worker prints `FACTORY:FIXES_READY`, **you commit and push the fixes** (the worker didn't):

```bash
export GITHUB_TOKEN=$(gh auth token)
git -C {{WORKTREE_PATH}} add -A
git -C {{WORKTREE_PATH}} commit -m "fix: address review feedback"
git -C {{WORKTREE_PATH}} push origin HEAD
```

Then proceed directly to Step 5 — **do not re-review.** Note in your final report that a review round found issues and a single fix pass was applied (unverified by re-review), so the human can confirm on merge.

## Step 5 — C4 Architecture Diff (you run it host-side)

The worker has no git, so **you** generate the C4 diff on the host after the single review (and any fix pass) is done (so the diagrams reflect the final code). You have the `c4-diff` skill loaded.

```bash
cd {{WORKTREE_PATH}}
BASE=$(git merge-base main HEAD)
# Follow the c4-diff skill with BASE and HEAD=HEAD, output to ./artifacts/
```

Then commit and push the diagrams, then **re-assemble the PR body with the same deterministic script** (now that `artifacts/diff.component.md` exists, it splices the C4 diff into an `## Architecture Changes` section between Summary and Test Output, and re-embeds the committed screenshots). Do **not** hand-splice into a `/tmp` file — that step used to be skipped and the diff never reached the PR:

```bash
export GITHUB_TOKEN=$(gh auth token)
git -C {{WORKTREE_PATH}} add -f artifacts/
git -C {{WORKTREE_PATH}} commit -m "docs: C4 architecture diff"
git -C {{WORKTREE_PATH}} push origin HEAD
SHA=$(git -C {{WORKTREE_PATH}} rev-parse HEAD)
PR_BODY=$(node .agents/skills/foreman/factory-pr-body.js \
  --worktree {{WORKTREE_PATH}} --sha $SHA --repo {{OWNER_REPO}})
gh pr edit <pr-number> --repo {{OWNER_REPO}} --body-file "$PR_BODY"
```

The script prints to stderr `architecture: spliced C4 diff before Test Output` on success — if instead it says `no diff at ...`, the c4-diff step didn't produce `artifacts/diff.component.md`; fix that before editing the PR. Verify on GitHub that both the Mermaid diagram **and** the screenshot images render.

## Step 6 — Cost report and status update

Post token costs from all agents (including your own feature-owner pane — GitHub integration + orchestration) as a PR comment:

```bash
bash .agents/skills/foreman/factory-cost-report.sh <pr-number> {{OWN_PANE_ID}} <worker-pane-id> <reviewer-pane-id> {{OWNER_REPO}}
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

If — and only if — auto-merge is authorized and the review was LGTM (no issues found), spawn a merger (host-side, needs `gh`/`bd`, not sandboxed):

```bash
herdr tab create --workspace {{WORKSPACE_ID}} --cwd {{WORKTREE_PATH}} --label merger --no-focus
# read <merger-pane-id> from .result.root_pane.pane_id
herdr pane run <merger-pane-id> "pi --model $MERGER_MODEL --session-id merger-${SESSION_SLUG} --name 'merger #{{GITHUB_ISSUE_NUMBER}}: {{TITLE}}' --skill .agents/skills/beads"
for i in $(seq 1 30); do
  sleep 2
  herdr agent list 2>&1 | grep -q '<merger-pane-id>' && break
done
herdr agent rename <merger-pane-id> "merger-{{GITHUB_ISSUE_NUMBER}}"
herdr agent prompt "merger-{{GITHUB_ISSUE_NUMBER}}" "Read your full instructions from .agents/skills/feature-owner/prompts/merger-prompt.md and follow them. Replace the placeholders with these values:
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
bash .agents/skills/feature-owner/sandbox/cleanup-orphans.sh --run-id {{GITHUB_ISSUE_NUMBER}}
```

Then print a concise final summary ending with a single machine-readable line the foreman can parse:

- `FACTORY:FEATURE_DONE:{{GITHUB_ISSUE_NUMBER}}:<pr-url>` — reviewed green PR, ready for human merge
- `FACTORY:FEATURE_MERGED:{{GITHUB_ISSUE_NUMBER}}:<pr-url>` — merged (only if auto-merge was authorized)
- `FACTORY:FEATURE_ESCALATED:{{GITHUB_ISSUE_NUMBER}}:<pr-url>` — needs human attention (worker blocked, fix pass failed, etc.)

Include in the human-readable part:
- PR URL
- Review outcome (e.g. "LGTM on first review", or "review found issues — one fix pass applied, not re-reviewed")
- Review summary (what the reviewer found, what the fix pass changed)
- Final test/lint status
- Whether a fix pass was applied (and that it was not re-reviewed)

## Rules

- **One issue only.** You own exactly one issue. Never touch the backlog or other issues.
- **You are the only GitHub actor.** The worker is sandboxed with no `gh`/`bd`/token. Every `git push`, `gh pr create`, `gh` comment/label, and `bd` update/sync is done by **you** on the host in response to a worker `FACTORY:` signal.
- **Never hand-assemble the PR body — use `factory-pr-body.js`.** Both screenshots and the C4 diff were repeatedly dropped or shipped as broken text when the LLM assembled the body by hand. The worker saves screenshots to `artifacts/screenshots/` and you generate the C4 diff to `artifacts/diff.component.md`; after committing them, run `node .agents/skills/foreman/factory-pr-body.js --worktree {{WORKTREE_PATH}} --sha <SHA> --repo {{OWNER_REPO}}` and pass its output to `gh pr create/edit --body-file`. It enumerates the **actually-committed** screenshots (ignoring the worker's often-wrong path text) into commit-pinned rendered images and splices the C4 diff — so neither can be silently omitted. Run it in Step 3 (screenshots) and again in Step 5 (after the diff exists).
- **Clarifications come back via GitHub *or* the worker pane.** When the worker signals `FACTORY:NEEDS_CLARIFICATION`, post the questions to the GitHub issue, then poll **both channels** each iteration: GitHub issue comments (newer than when you asked, not authored by you) **and** the worker pane's output. If the human answers on GitHub, relay it into the worker pane with `pane run`. If the human instead attaches to the worker pane and answers pi directly, detect the worker's own `FACTORY:READY_TO_PUSH`/`NEEDS_CLARIFICATION` and proceed accordingly — never strand the owner waiting on a channel the human didn't use. GitHub is the default path; the worker pane is an equally-supported fallback.
- **Conservative by default.** Do not merge PRs, push to main, or close issues unless explicitly authorized.
- **Commit + push as the factory bot, not the human.** Run `bash .agents/skills/foreman/factory-git-identity.sh {{WORKTREE_PATH}}` once at setup so every commit/push from this worktree is authored and authenticated as the bot `gh` is logged in as — scoped to this worktree only, leaving the host's global git identity intact. If a commit ever shows the human's name/email, you skipped this.
- **GITHUB_TOKEN.** Always set it from `gh auth token` before any `bd github` or `gh` command.
- **Worker runs sandboxed.** Always launch the worker's `pi` via the `.cmd` shim `.\.agents\skills\feature-owner\sandbox\sandbox-run.cmd --run-id {{GITHUB_ISSUE_NUMBER}} -- pi …` (Windows/PowerShell panes); on non-Windows call `sandbox-run.sh` directly. Worker skill: `--skill .agents/skills/grill-me` only (no `beads`, no `c4-diff` — both need git/GitHub the worker doesn't have).
- **Drive the sandboxed worker with `pane` commands, not `agent` commands.** herdr can't classify a `pi` running behind the `docker` wrapper (Windows), so `herdr agent prompt/read/rename/wait` don't work on the worker. Use `pane run` (prompt), `pane wait-output --match/--regex` (await signals), `pane read` (output), `pane send-keys` (control keys), and the **worker pane id** as the handle. The host-side reviewer and merger classify normally — use `agent` commands for them.
- **Reviewer/merger run host-side.** Reviewer skill: `--skill .agents/skills/pr-review`. Merger skill: `--skill .agents/skills/beads`.
- **Regenerate host-side dependency shims before reviewing (Step 4a-prep).** The worker installs deps inside the Linux sandbox, producing only Unix `.bin` symlinks; the Windows host reviewer needs `.cmd`/`.ps1` shims to run `npm test`/`npm run build`. Always run a host-side `npm install` in each JS package before spawning the reviewer, or the reviewer reviews blind (`'vitest' is not recognized`).
- **Intelligence tiers.** Always pass `--model` from `.agents/factory-config.json` when spawning agents.
- **Config reads use `node`, not `jq`** — via `sandbox/config-get.sh` (jq isn't reliably on the pane PATH).
- **Focus.** Always use `--no-focus` when spawning subagents.
- **One tab per agent.** Spawn each subagent in its **own tab** inside your feature's workspace (`herdr tab create --workspace {{WORKSPACE_ID}} --cwd {{WORKTREE_PATH}} --label <role>`), reading the pane id from `.result.root_pane.pane_id`. The worker, reviewer, and merger each get a full-height `worker`/`reviewer`/`merger` tab. Do not split your own pane for subagents.
- **Do not read subagent prompt files yourself.** Tell subagents to read their own prompt files to keep your context clean.
