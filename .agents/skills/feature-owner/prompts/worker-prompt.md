You are working on beads issue `{{ID}}`: **{{TITLE}}**

**Description:**
{{DESCRIPTION}}

**Design notes (if any):**
{{DESIGN}}

> **You run inside a Docker sandbox.** You have `node`, `npm`, `ripgrep`, and Playwright + Chromium, but **no `gh`, no `bd`, no GitHub token, and no working git** — by design. Your git worktree's metadata lives on the host, outside your sandbox, so **do not run git commands** (they will fail). You implement, test, and screenshot; your file changes land on the host automatically (the worktree is bind-mounted). You hand off to the feature-owner with `FACTORY:` signals; it does **all** git and GitHub/beads work (commit, push, PR, diff).

## Your workflow

### Phase 1 — Grill-me (MANDATORY, do not skip)

You have the grill-me skill loaded. Use it now.

1. Read the issue description and explore the codebase thoroughly (file structure, existing types, API routes, UI components, tests).
2. Build a **design tree** of every decision needed to implement this issue. Print the full tree.
3. Compute the **frontier** — every decision whose prerequisites are settled and can be asked now. Print the frontier as a numbered list. For each question, give your recommended answer based on what you found in the codebase.
4. For each frontier question, classify it:
   - **RESOLVED**: The issue description **explicitly states** the answer, OR there is only one technically valid option. "The codebase happens to do X elsewhere" is NOT sufficient — that's a recommendation, not a constraint.
   - **OPEN**: The issue description is silent or ambiguous on this point AND more than one reasonable approach exists. Mark it OPEN even if you have a strong recommendation.

   Bias toward OPEN. A question is OPEN if a thoughtful developer could reasonably disagree with your recommended answer. Examples of OPEN questions:
   - Scope/filtering choices not mentioned in the issue
   - UI placement when multiple pages could host the feature
   - Data format details (columns, ordering, naming) not specified
   - Whether to add new UI controls (date pickers, dropdowns) vs. keeping it simple

### Phase 2 — Decision

> You run inside a sandbox with **no GitHub access** (`no gh`, `no bd`, no token). You never sync or write to beads. You communicate upward by printing `FACTORY:` signals; the feature-owner performs all GitHub/beads writes on your behalf.

- **If ALL frontier questions are RESOLVED** (frontier is empty of OPEN questions):
  Print `FACTORY:FRONTIER_CLEAR`.
  Then proceed to Phase 3.

- **If ANY frontier question is OPEN**:
  Print the numbered open questions (with your recommended answers) to your output so the feature-owner can record them in beads and on GitHub.
  Print `FACTORY:NEEDS_CLARIFICATION` on its own line.
  Stop and wait — the user will attach to this pane for a grill-me session.
  After clarification, print the agreed design to your output (the feature-owner records it), then proceed to Phase 3.

### Phase 3 — Implementation (only after Phase 1 and 2)

- Seed test data: `bash .agents/skills/foreman/factory-seed-data.sh`
- Install dependencies: `cd app && npm install`
- Implement the solution
- Fix any failures until tests and linter pass

### Phase 4 — Proof of Work (MANDATORY before hand-off)

Collect evidence that the change works. This goes into the PR body.

1. **Tests**: Run `npm test` from the `app/` directory. Capture the full output (last 20 lines are enough for the PR).
2. **Linter**: Run `npm run lint` from the `app/` directory. Capture the full output.
3. **Screenshots** (if frontend files were changed): Capture **every** screen your change touches, not just one. Before capturing, enumerate all impacted routes/screens:
   - The screen you directly edited (e.g. the page with the new button/field).
   - **Every other screen affected by the change.** If you added navigation to a new or existing screen (a button/link that opens another page, a new route, a modal, a redirect target), that destination screen is impacted too — screenshot it as well. Example: adding a button on the dog detail page that links to a new screen requires **two** screenshots — the detail page (showing the new button) **and** the new screen it links to.
   - Any screen whose layout/appearance shifts as a side effect of your change.
   Produce one screenshot per impacted screen (a single screenshot is only acceptable when exactly one screen is impacted).

   Pick random available ports to avoid collisions with other workers:
   ```bash
   # Pick random ports in the 3100-3999 and 5200-5999 ranges
   BACKEND_PORT=$((3100 + RANDOM % 900))
   FRONTEND_PORT=$((5200 + RANDOM % 800))
   # Start backend
   PORT=$BACKEND_PORT npm run dev --prefix app/backend &
   # Start frontend (must cd into frontend dir — vite has no --prefix flag)
   cd app/frontend && BACKEND_PORT=$BACKEND_PORT npx vite --port $FRONTEND_PORT &
   cd ../..  # return to repo root
   # Wait for servers to be ready
   sleep 8
   # Take a screenshot of EACH impacted screen (you have Playwright + Chromium preinstalled in the sandbox)
   # Save under artifacts/screenshots/ — this dir IS committed (it's not gitignored, unlike repo-root /screenshots/).
   mkdir -p artifacts/screenshots
   # One command per impacted screen, each with its own descriptive filename:
   npx playwright screenshot --wait-for-timeout 3000 http://localhost:$FRONTEND_PORT/<path-to-edited-screen> artifacts/screenshots/dog-detail.png
   npx playwright screenshot --wait-for-timeout 3000 http://localhost:$FRONTEND_PORT/<path-to-linked-screen> artifacts/screenshots/new-screen.png
   ```
   Save every screenshot under `artifacts/screenshots/` from the **repo root** (give each a descriptive name, e.g. `artifacts/screenshots/dog-delete.png`). Do **not** use a bare `screenshots/` dir (repo-root `/screenshots/` is gitignored) and do **not** `cd` into `app/` first (that would put them at `app/screenshots/`, off the expected path).
   Stop the dev servers after capturing (kill the background jobs).

   **Screenshot validation (MANDATORY):** After capturing, read **each** screenshot and verify:
   - You have **one screenshot per impacted screen** — if your change navigates to or affects another screen, that screen must have its own screenshot too. A single screenshot when multiple screens are impacted is **incomplete** — do not proceed.
   - Each screenshot shows the **specific page/component** it is meant to prove, not a generic landing page or error screen.
   - Your new UI element (button, field, export link, etc.) is **visibly present** in the screenshot of the screen it belongs to, and any linked/new destination screen is captured and renders correctly.
   - If any screenshot is wrong (wrong page, blank, error, missing screen, or your change isn't visible): **do not proceed**. Debug the issue, retake the screenshot(s), and validate again. Repeat until you have genuine visual proof of **every** impacted screen.
   - "Tests pass so it's fine" is **NOT acceptable** as a substitute for a correct screenshot. The screenshot exists to prove the UI works end-to-end in a real browser, which tests alone cannot prove.

### Phase 5 — Hand off (you do NOT touch git, push, or open the PR)

> You have no working git, no `gh`, and no GitHub token. Your edited/created files are already on the host via the bind mount. The feature-owner commits, pushes, and opens the PR. Your only job now is to write the PR body to a file and signal.

1. Build the PR body from the template at `.agents/skills/foreman/pr-template.md` and write it to `artifacts/pr-body.md` (create the `artifacts/` dir if needed). Fill the placeholders:
   - `{{GITHUB_ISSUE_URL}}` — the full GitHub issue URL
   - `{{SUMMARY}}` — one-line description of the change
   - `{{TEST_OUTPUT}}` — last 20 lines of `npm test` output
   - `{{LINT_OUTPUT}}` — lint output (or "Clean — no warnings or errors.")
   - `{{SCREENSHOTS}}` — if you captured screenshots, list **every** one (one line per impacted screen) as `artifacts/screenshots/<filename> — <caption>` (use the real path under `artifacts/screenshots/`). When a change spans multiple screens (e.g. a new button plus the screen it links to), list all of them. The feature-owner turns these into commit-pinned image links after it commits (you don't know the commit SHA — it doesn't exist yet). If no frontend work, write "N/A — backend-only change."
2. Print `FACTORY:READY_TO_PUSH` on its own line. Stop. The feature-owner commits your files, pushes, and opens the PR.

> **Review fixes:** when the feature-owner relays reviewer feedback, address it, re-run tests + linter, then print `FACTORY:FIXES_READY`. Do not commit or push.
