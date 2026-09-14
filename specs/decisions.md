# Docker Sandbox — Design Decisions

Design decisions for implementing `sandbox.md` in this repository. Produced through a grill-me
session against the **actual** factory architecture (pi skills + herdr + bash), which differs
from the architecture the spec assumes (Vite frontend / Node backend / TypeScript run
orchestration).

## Context: the real factory vs. the spec's assumed factory

The spec `sandbox.md` assumes a factory shaped as: Vite frontend → Node backend → TypeScript
run orchestration (`SandboxProvider` / `DockerSandbox` classes) → container.

**That orchestration layer does not exist in this repo.** The real factory is:

- **pi skills (markdown) + herdr (terminal multiplexer) + bash scripts.** The
  foreman / feature-owner / worker / reviewer are skill docs. "Run orchestration" is
  `herdr pane run "pi --model … --skill …"` inside a herdr-managed git worktree pane.
- The `app/` Vite+Express project is the **DogTrainr demo app the factory builds features
  for** — not the factory itself. `backend/src/` is empty.
- A "run" = a `pi` agent process launched in a herdr pane inside a git worktree.

**Key feasibility fact:** herdr detects and controls agents by **scraping the pane's terminal
buffer**, not by process-tree inspection. So running `pi` as `docker run -it … pi` in a pane
keeps herdr's `agent prompt` / `read` / `rename` working — the approach is viable.

## Core decision: adapt the spec to the real factory

Keep the spec's **goals** (disposable per-run container, worktree mounted at `/workspace`,
run-local copied `auth.json`, security defaults, cleanup, orphan recovery) but implement them
where runs actually happen: the herdr-spawned `pi` command. No TypeScript `SandboxProvider`
layer. Prefer deterministic `tsx`/bash scripting over prompt-based orchestration wherever it
makes sense.

## Decisions

### 1. Scope — worker only
Sandbox the **worker only**. The worker is the only agent that runs agent-authored
shell/filesystem workloads (grill, implement, run tests, screenshots). The reviewer reads a
diff; the merger runs `gh`/`bd`. Both stay host-side for v1. Revisit later if desired.

### 2. No abstraction layer — deterministic scripts
No `SandboxProvider`/`DockerSandbox` TypeScript classes. The "sandbox abstraction" becomes bash
helper scripts (and `npx tsx` where it beats bash) plus config in `.agents/factory-config.json`.
Prefer scripting over prompt-based orchestration.

### 3. Execution model — foreground `docker run --rm -it`
The worker pane runs, in the foreground:

```
docker run --rm -it \
  --label software-factory.sandbox=true --label software-factory.run-id=<id> \
  --workdir /workspace \
  --mount type=bind,src=<worktree>,dst=/workspace \
  --mount type=bind,src=<run-pi-dir>,dst=/home/pwuser/.pi/agent \
  --cap-drop ALL --security-opt no-new-privileges \
  --pids-limit 512 --memory 4g --cpus 2 --tmpfs /tmp:size=1g \
  -e HOME=/home/pwuser \
  <factory-agent-image> \
  pi --model <worker> --session-id … --name … --skill …
```

Killing the pane kills pi kills the container; `--rm` auto-cleans. Herdr keeps controlling it
via terminal-buffer scraping. No separate detached-container + `docker exec` channel.
The TTY flag is `-it` in a real pane and `-i` in a headless/CI context (`sandbox-run.sh`
detects `[[ -t 0 ]]`). On Windows the image's built-in `pwuser` (uid 1000) is used — see
decision 7 — not the Playwright base's default root.

**IMPLEMENTED & VALIDATED** against real Docker Desktop on Windows: image build, mount
write-back to the host worktree, auth-only inference readiness, a real one-shot `pi` inference
call, `npm install` + 130 backend tests, and an in-container Playwright screenshot of the live
dev server written back to the host — all pass. Security acceptance checks pass: `CapDrop=ALL`,
`NoNewPrivs=1`, no Docker socket, no host-drive leak, only the two intended mounts, labels
present. Orphan cleanup by label works and leaves unrelated containers untouched.

### 4. Image — Playwright base + full worker toolchain
Base `mcr.microsoft.com/playwright:v1.x-jammy` (Chromium preinstalled) so the worker can take
its mandatory proof-of-work screenshots **inside** the container. Add `node 22, git, jq,
ripgrep` and `pi` (`@earendil-works/pi-coding-agent@0.84.4`) globally. Unprivileged `agent`
user. **Deliberately absent: `gh`, `bd`, `GITHUB_TOKEN`** (see decision 8). Dockerfile lives in
the factory (e.g. `.agents/factory-image/Dockerfile`); bootstrap builds it. Node/pi versions
derived from the repo, not invented.

### 5. Screenshots run in-container
Dev servers (vite/express) start on random ports **inside** the container; Playwright hits them
at container-localhost. No host port publishing (`-p`) needed. Workers keep full Playwright
access in-sandbox.

### 6. Auth — copy `auth.json` only, run-local
Before container start, copy host `~/.pi/agent/auth.json` →
`<data>/runs/<id>/sandbox/pi/auth.json` (mode 0600), mounted writable at
`/home/pwuser/.pi/agent`. **auth-only — validated:** `pi auth check --provider <provider>`
returns `{"status":"ready"}` inside the container with just the copied `auth.json` (no
`models-store.json`/`settings.json` needed). Canonical host credential is never mounted, never
modified, never symlinked. Each run gets its own physical copy.

### 7. Windows UID/GID — drop the `--user` mapping
The spec's `--user $(getuid):$(getgid)` is Linux-specific. On Docker Desktop/Windows the bind
mount is virtualized (gRPC-FUSE) and host UID mapping doesn't apply. Run as the image's built-in
`pwuser` (uid 1000, shipped by the Playwright base) and rely on Docker Desktop's mount
translation for write-back — **validated**: a container writing to `/workspace` as `pwuser`
appears correctly on the host worktree. Keep all other security
flags (`--cap-drop ALL`, `--no-new-privileges`, `--pids-limit`, `--memory`, `--cpus`,
`--tmpfs /tmp`).

### 8. Credential boundary — hoist ALL git + GitHub state changes to the feature-owner

> **Amended after implementation.** A linked git worktree's `.git` is a *file* pointing to
> `<main-repo>/.git/worktrees/<name>`, which lives **outside** the bind-mounted worktree. So
> git cannot function inside the sandbox at all (not just push — also `commit`, `diff`,
> `merge-base`). Mounting the shared `<main>/.git` to fix this would expose every other
> worktree and the whole object store, violating the mount rules below. Resolution: **the
> worker never runs git.** It only produces *file changes* (visible on the host via the bind
> mount) and signals desired state upward. This is the purest form of "agents communicate
> desired state changes upward" — the worker is a pure code-producer; the host owns all VCS.

The worker's credential/authority-bearing operations are **all** hoisted to the feature-owner:

1. `git commit` / `git push` → feature-owner (host)
2. `gh pr create` / `gh` comments + labels → feature-owner (host)
3. `bd update` / `bd github sync` → feature-owner (host)
4. **C4 diff** (`git diff` / `merge-base`, the `c4-diff` skill) → feature-owner (host); moved
   off the worker because it needs git. It only analyzes a diff — it runs no agent-authored
   code — so running it host-side does not weaken the sandbox invariant.

```
worker (in container)          feature-owner (host)
─────────────────────          ────────────────────
grill / implement / test
edit files (no git)  ─────►    (file changes appear on host via bind mount)
screenshots
write artifacts/pr-body.md
print FACTORY:READY_TO_PUSH
                               git add + commit
                               git push origin HEAD
                               finalize screenshot links (needs commit SHA)
                               gh pr create
                               (review loop; fixes: worker edits → host commits + pushes)
                               c4-diff → commit + push + gh pr edit
                               bd update / bd github sync
```

Worker signals: `FACTORY:FRONTIER_CLEAR`, `FACTORY:NEEDS_CLARIFICATION` (prints questions to
stdout — the feature-owner writes them to beads/GitHub), `FACTORY:READY_TO_PUSH`,
`FACTORY:FIXES_READY`.

**Net credential boundary:**
- Sandbox holds: **inference `auth.json` only** (run-local copy, 0600). This is not a
  GitHub-repo credential — it's how `pi` authenticates to the model provider for inference.
  Unavoidable; without it the agent can't think. Verified `ready` in-container with the
  auth-only copy.
- Sandbox never holds: `GITHUB_TOKEN`, git push credentials, a working git checkout, `gh`
  config, beads write authority.
- Blast radius of a compromised worker: scribble in its own worktree, burn inference tokens. It
  **cannot** commit, push, open PRs, or mutate issue state. Every repo-facing mutation is a
  deliberate, deterministic host-side step by the feature-owner. Materially stronger than the
  spec required.

### 9. Config + provider selection
New `sandbox` section in `.agents/factory-config.json`:
`{ enabled, image, limits{cpus,memory,pids}, network }`. `network: "default"` (inference needs
egress). **Default: sandboxed (`enabled: true`)**; `enabled: false` reverts to today's host path
(`herdr pane run "pi …"`).

### 10. Concurrency — parallel-safe by construction
The beads Dolt DB (`embeddeddolt/`) is gitignored per-checkout local state, **not** shared. The
source of truth is git (committed `interactions.jsonl` + `metadata.json`) plus GitHub Issues via
`bd github sync`. Inside a container the bind mount carries only git-tracked `.beads` files (no
`redirect`, no `embeddeddolt/`), so `bd` — *if it ran there* — would hydrate a fresh isolated
local DB. Since beads/GitHub ops are hoisted to the host (decision 8), the single authoritative
beads writer per issue is the feature-owner. Parallel workers each get: own container + own
bind-mounted worktree + own commits; convergence via GitHub + `factory-reconcile.sh` exactly as
today. Concurrent syncs race idempotently at the GitHub API — reconcile already handles it.

### 11. Lifecycle & cleanup
```
worktree create (host, by foreman)
  → prepare run-pi-dir + copy auth.json (sandbox-run.sh)
  → docker run --rm -it in worker pane (sandbox-run.sh)
  → worker edits files + FACTORY:READY_TO_PUSH
  → feature-owner (host): git add/commit + push + gh pr create + review loop + c4-diff + bd
  → container exits (--rm auto-removes) when the pane's pi exits
  → cleanup-orphans.sh --run-id <id> (defensive)
  → existing worktree cleanup
```
Container must be stopped/released before the worktree is removed. Startup recovery: bootstrap
runs `cleanup-orphans.sh --all`, enumerating `label=software-factory.sandbox=true`. Do not touch
unrelated containers.

## Filesystem layout

```
<data-dir>/                      # default: $HOME/.software-factory (override: SOFTWARE_FACTORY_DATA_DIR)
  runs/
    <run-id>/
      sandbox/
        pi/
          auth.json        # run-local copy, 0600
```

Two host paths mounted into the container:

```
<host worktree>              -> /workspace
<data>/runs/<id>/sandbox/pi  -> /home/pwuser/.pi/agent   (writable)
```

On Windows, `sandbox-run.sh` translates these to Docker-Desktop paths with `cygpath -m` and sets
`MSYS_NO_PATHCONV=1` to stop Git Bash from mangling container-side paths.

Never mount: `/`, `/home`, `~`, the Docker socket, the factory source dir, the full data dir,
the shared `<main>/.git`, SSH dirs, other runs, other worktrees.

## Files created

- `.agents/factory-image/Dockerfile` — Playwright base + node/git/jq/ripgrep + pi
- `.agents/skills/feature-owner/sandbox/sandbox-run.sh` — prepares auth, builds/launches
  `docker run` (or execs on host when disabled)
- `.agents/skills/feature-owner/sandbox/prepare-pi-auth.sh` — copies auth.json run-local (0600)
- `.agents/skills/feature-owner/sandbox/cleanup-orphans.sh` — removes labeled containers
- `.agents/skills/feature-owner/sandbox/build-image.sh` — builds the image from config
- `.agents/skills/feature-owner/sandbox/config-get.sh` — reads config via `node` (no `jq`
  dependency — jq isn't reliably on the pane PATH)
- `.agents/skills/foreman/factory-bootstrap.sh` — builds the image + cleans orphans on setup
- `.agents/factory-config.json` — added `sandbox` section (+ `feature-owner`/`merger` tiers)
- `.agents/skills/feature-owner/SKILL.md` — worker launched via `sandbox-run.sh`; all
  git/gh/bd/c4-diff hoisted to the feature-owner
- `.agents/skills/feature-owner/prompts/worker-prompt.md` — worker runs no git; edits files +
  writes `artifacts/pr-body.md` + emits `FACTORY:READY_TO_PUSH` / `FACTORY:FIXES_READY`
- `.agents/skills/foreman/SKILL.md` — spawns feature-owner with the `c4-diff` skill

## Non-goals (from the spec)

No Firecracker / Kubernetes / gVisor / remote execution / E2B. No Docker socket access from the
agent. No credential proxy / token brokering. No network domain allowlists. No
Docker-in-Docker. No automatic sync-back of refreshed Pi credentials. No replacement of the
existing git worktree implementation.
