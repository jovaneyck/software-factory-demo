---
name: start-factory
description: "Start the software factory and (optionally) keep it running. Use when the user says 'start the factory', 'run the factory', 'kick off the factory', 'boot the factory', or asks to begin processing the backlog. Covers the two-step startup: (1) launch the foreman for a factory pass, and (2) start the GitHub polling watcher for continuous mode. Use this before handing off to the foreman skill."
---

# Start Factory — Two-Step Startup

Starting the factory is a **two-step process**. Step 1 runs the factory once (a single pass over the currently-ready backlog). Step 2 is **optional** and turns on continuous operation by polling GitHub for new issues. Starting the factory is **not** the same as starting the poller — do Step 2 only if the user wants the factory to keep picking up new issues on its own.

Decide with the user which they want:

- **Single pass** — drain the currently-ready issues, then stop. Just Step 1.
- **Continuous mode** — also start the watcher so new GitHub issues get picked up automatically. Step 1 **and** Step 2.

If the user just says "start the factory" without specifying, ask which one they want (or default to a single pass and offer to enable continuous mode).

## Prerequisites

Run the bootstrap script once after cloning (it configures beads custom statuses, creates GitHub labels, sets up the GitHub integration, and prints trust instructions for worktree panes):

```bash
bash .agents/skills/foreman/factory-bootstrap.sh
```

Before every factory run, verify:

```bash
test "${HERDR_ENV:-}" = 1   # Must be inside Herdr
export GITHUB_TOKEN=$(gh auth token)
bd github status            # Must show ✓ Configured
```

If any check fails, stop and tell the user what's missing.

## Step 1 — Start the factory (foreman)

The factory itself is run by the **foreman**. Load its skill and run one factory pass. The foreman's loop is a **single pass**: it syncs GitHub once, triages the ready backlog, and dispatches a feature-owner per ready issue. It does **not** poll on a timer.

To start the foreman, follow the `.agents/skills/foreman` skill. In a Herdr session, this typically means spawning the foreman in its own pane using `pane run` + `agent rename` (not `herdr agent start` — on Windows `pi` is a Node.js shell script that `Start-Process` cannot launch). Load the foreman skill config for the model tier:

```bash
FOREMAN_MODEL=$(cat .agents/factory-config.json | jq -r '."tiers"."foreman"')
```

Then hand off to the foreman skill for the actual sync → triage → dispatch loop.

If the user only wants a single pass, you're done after the foreman reports. Otherwise continue to Step 2.

## Step 2 — Start the GitHub polling watcher (continuous mode)

This step is **optional** and only for continuous operation. The watcher is **separate from the foreman** — it runs in its own pane, polls `bd github sync` on an interval, and sends `/factory` to the foreman pane whenever new ready issues appear. Starting the factory does not start this automatically.

Set it up from any pane:

```bash
herdr pane split --current --direction down --cwd "$PWD" --no-focus
herdr pane run <pane-id> "powershell -File .agents/skills/foreman/factory-watcher.ps1 -Interval 30"
```

On Git Bash / non-Windows shells, use `factory-watcher.sh` instead of the `.ps1` script. `-Interval 30` polls every 30 seconds — adjust to taste.

Once the watcher is running, the factory will keep picking up new GitHub issues without further prompting until the watcher pane is stopped.

## Rules

- **Two distinct steps.** Starting the factory (Step 1) and starting the poller (Step 2) are separate. Never assume "start the factory" means continuous mode — confirm with the user.
- **Prerequisites first.** Always verify Herdr, `GITHUB_TOKEN`, and `bd github status` before launching.
- **GITHUB_TOKEN.** Always set it from `gh auth token` before any `bd github` or `gh` command.
- **Hand off to the foreman.** This skill gets the factory started; the foreman skill owns the sync/triage/dispatch loop. Don't duplicate its work here.
