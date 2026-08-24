You are working on beads issue `{{ID}}`: **{{TITLE}}**

**Description:**
{{DESCRIPTION}}

**Design notes (if any):**
{{DESIGN}}

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
  Write the open questions to the beads issue: `bd update {{ID}} --notes="<numbered open questions with recommended answers>"`
  Print `FACTORY:NEEDS_CLARIFICATION` on its own line.
  Stop and wait — the user will attach to this pane for a grill-me session.
  After clarification, write the agreed design to the issue: `bd update {{ID}} --design="<design>"`
  Sync status to GitHub: `export GITHUB_TOKEN=$(gh auth token) && bd github sync --push-only`
  Then proceed to Phase 3.

### Phase 3 — Implementation (only after Phase 1 and 2)

- Install dependencies first: `cd app && npm install`
- Implement the solution
- Fix any failures until tests and linter pass

### Phase 4 — Proof of Work (MANDATORY before PR)

Collect evidence that the change works. This goes into the PR body.

1. **Tests**: Run `npm test` from the `app/` directory. Capture the full output (last 20 lines are enough for the PR).
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
   mkdir -p screenshots
   npx playwright screenshot --wait-for-timeout 2000 http://localhost:$FRONTEND_PORT/<relevant-path> screenshots/proof.png
   ```
   Stop the dev servers after capturing (kill the background jobs).

### Phase 5 — PR Submission

Use the PR template at `.agents/skills/foreman/pr-template.md` to build the PR body. Follow these steps exactly:

1. Stage and commit implementation: `git add -A && git commit -m "feat(<scope>): <title>"`
2. If screenshots were captured, commit them in the same branch:
   ```bash
   git add screenshots/ && git commit -m "docs: add proof-of-work screenshots"
   ```
3. Push the branch: `git push origin HEAD`
4. Build the PR body by filling in the template placeholders:
   - `{{GITHUB_ISSUE_URL}}` — the full GitHub issue URL
   - `{{SUMMARY}}` — one-line description of the change
   - `{{TEST_OUTPUT}}` — last 20 lines of `npm test` output
   - `{{LINT_OUTPUT}}` — lint output (or "Clean — no warnings or errors.")
   - `{{SCREENSHOTS}}` — see below
5. For the `{{SCREENSHOTS}}` section:
   - If screenshots exist, get the commit SHA and build image links:
     ```bash
     SHA=$(git rev-parse HEAD)
     # Use this markdown for each screenshot:
     # ![description](https://github.com/<owner>/<repo>/blob/$SHA/screenshots/<filename>?raw=true)
     ```
   - If no frontend work, use "N/A — backend-only change."
   - Use the commit SHA (not the branch name) in the URL to avoid slash-encoding issues.
6. Create the PR:
   ```bash
   gh pr create --title "<title>" --body-file <(echo "<filled template>") --base main
   ```
7. Print `FACTORY:PR_CREATED:<pr-url>` on its own line
