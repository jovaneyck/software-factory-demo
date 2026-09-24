Closes https://github.com/jovaneyck/software-factory-demo/issues/24

## Summary

**Built by gpt 6 astra.**

Export a selected dog's complete recorded training-session history from the **Progress report screen with graphs**, as requested in the issue's grill-me feedback. The download includes completed/skipped sessions across all trainings and dates, independent of graph filters, and works without an assigned plan.

- UTF-8 BOM/CRLF CSV with dates, dog/training names and IDs, plan/session IDs, status, score, and notes.
- CSV escaping and spreadsheet-formula protection via Papa Parse; empty histories produce headers only.
- Inline error/retry and busy state; no dog-profile changes, generated planned sessions, or schema changes.
- Fresh implementation for #24; existing CSV PRs #21/#23 were not reused.

## Test Output

```text
npm test (app/)
Backend:  Test Files  11 passed (11)
          Tests      131 passed (131)
Frontend: Test Files  17 passed (17)
          Tests      103 passed (103)
Total: 234 passing tests

Test-first: 12 new API cases failed before implementation, then passed.
Test-first: 5 new UI cases failed before implementation, then passed;
           the no-selection case already passed.
Review regression: API-accepted arrays receive formula protection.

node artifacts/verify-browser.cjs
PASS: 12 persisted records downloaded and parsed from the real browser.
PASS: all dates/trainings despite graph filters; correct dog and ordering.
PASS: UTF-8 BOM, filename, empty history without plan, HTTP failure/retry.
PASS: desktop 1440x1000 and fresh mobile 390x844, no mobile overflow.
PASS: no browser exceptions; five screenshots visually inspected.
PASS: before/after/diff C4 diagrams parsed and rendered in Mermaid 11.
```

## Lint Output

```text
npm run lint (app/): backend ESLint + frontend ESLint passed.
npm run build (app/backend/): TypeScript passed.
npm run build (app/frontend/): TypeScript + Vite production build passed.
Changed source/test files: initial Prettier check passed; later concurrent
editor formatting was preserved without behavioral changes.
git diff --check: passed.
```

Non-blocking existing warnings: outdated Browserslist data, Vite's large bundle warning, and an existing TrainingEdit test's unmatched-route warning.

## Browser Evidence

Reproduce with seeded worktree data and backend/frontend servers on ports 3847/5847, then run `node artifacts/verify-browser.cjs`. `FRONTEND_URL` can override the frontend URL. The script verifies actual downloads and cleans up its temporary dog. The sample CSV in `artifacts/training-sessions-sample.csv` contains only repository seed data.

Known pre-existing limitation, not changed here: the graph measures its width when rendered, not on viewport resize. Mobile proof uses a fresh mobile page load; resizing a mounted desktop graph can overflow until it renders again.

## Screenshots

artifacts/screenshots/report-trainings-desktop.png - Progress report with selected dog and export action before selecting a training.
artifacts/screenshots/report-graph-desktop.png - Desktop progress graph with the full-history CSV export action.
artifacts/screenshots/report-graph-mobile.png - Mobile progress graph and export control, fresh 390px viewport.
artifacts/screenshots/report-export-error-mobile.png - Download failure leaves the graph visible and permits retry.
artifacts/screenshots/report-empty-mobile.png - Export remains available for a dog without a plan or recorded sessions.

## Factory Execution

Implemented directly in Copilot under the user's override: no Herdr, no pi sandbox, no continuous watcher. Design questions and their resolution are recorded on issue #24. This PR is not auto-merged.

Independent review found one P2 formula-protection bypass for API-accepted array values. One fix pass normalizes CSV cells before formula protection and adds a passing API regression. The fix was not independently re-reviewed, per factory policy. Full review details and cost disclosure are committed in `artifacts/review.md` and `artifacts/cost-report.md` and posted on the PR. User-supplied inference figures: main session 150K tokens (EUR 16), reviewer 20K tokens (EUR 2), **total 170K tokens and EUR 18**.