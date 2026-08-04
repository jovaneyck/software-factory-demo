# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Test Commands

### Backend (`backend/`)
- `npm run dev` — Start dev server with tsx watch (port 3001)
- `npm test` — Run all tests (vitest)
- `npm run test:watch` — Run tests in watch mode
- `npx vitest run src/dogs.test.ts` — Run a single test file

### Frontend (`frontend/`)
- `npm run dev` — Start Vite dev server (proxies `/api` to backend:3001)
- `npm test` — Run all tests (vitest + jsdom)
- `npm run test:watch` — Run tests in watch mode
- `npx vitest run src/DogList.test.tsx` — Run a single test file
- `npm run lint` — ESLint
- `npm run build` — TypeScript check + Vite build

## Architecture

Monorepo with two independent npm projects (no root package.json scripts — run commands from `backend/` or `frontend/`).

### Backend
- Express API
- File-based persistence — JSON files in `data/{dogs,trainings,plans}/` (gitignored)
- File uploads via multer to the same data dirs
- App is exported for testing; server only starts when `NODE_ENV !== 'test'`
- Tests use supertest against the exported app, with `beforeEach`/`afterEach` that wipe the data directories

### Frontend
- React 19 + React Router 7 + Vite
- Each feature has paired `Component.tsx` / `Component.test.tsx` files
- Tests use Testing Library with `vi.spyOn(global, 'fetch')` for API mocking
- Markdown editing via `@uiw/react-md-editor`

### Domain Model
Three entities, all stored as JSON files with UUID ids:
- **Dogs** — name, picture (uploaded file), optional planId
- **Trainings** — name, procedure (markdown), tips (markdown), optional images
- **Plans** — name, weekly schedule (map of weekday → array of training IDs)

Dogs can be assigned a single training plan.

### API Routes
All routes prefixed with `/api/`:
- `GET/POST /dogs`, `GET/DELETE /dogs/:id`, `PUT/DELETE /dogs/:id/plan`
- `GET/POST /trainings`, `GET/PUT/DELETE /trainings/:id`, `POST /trainings/:id/images`
- `GET/POST /plans`, `GET/PUT/DELETE /plans/:id`

### Frontend Routes
- `/` — Dog list, `/dogs/new` — Add dog, `/dogs/:id` — Dog profile
- `/trainings` — Training list, `/trainings/new` — Add, `/trainings/:id` — Detail, `/trainings/:id/edit` — Edit
- `/plans` — Plan list, `/plans/new` — Add, `/plans/:id` — Detail, `/plans/:id/edit` — Edit


<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:6cd5cc61 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.

## Agent Context Profiles

The managed Beads block is task-tracking guidance, not permission to override repository, user, or orchestrator instructions.

- **Conservative (default)**: Use `bd` for task tracking. Do not run git commits, git pushes, or Dolt remote sync unless explicitly asked. At handoff, report changed files, validation, and suggested next commands.
- **Minimal**: Keep tool instruction files as pointers to `bd prime`; use the same conservative git policy unless active instructions say otherwise.
- **Team-maintainer**: Only when the repository explicitly opts in, agents may close beads, run quality gates, commit, and push as part of session close. A current "do not commit" or "do not push" instruction still wins.

## Session Completion

This protocol applies when ending a Beads implementation workflow. It is subordinate to explicit user, repository, and orchestrator instructions.

1. **File issues for remaining work** - Create beads for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **Handle git/sync by active profile**:
   ```bash
   # Conservative/minimal/default: report status and proposed commands; wait for approval.
   git status

   # Team-maintainer opt-in only, unless current instructions forbid it:
   git pull --rebase
   git push
   git status
   ```
5. **Hand off** - Summarize changes, validation, issue status, and any blocked sync/commit/push step

**Critical rules:**
- Explicit user or orchestrator instructions override this Beads block.
- Do not commit or push without clear authority from the active profile or the current user request.
- If a required sync or push is blocked, stop and report the exact command and error.
<!-- END BEADS INTEGRATION -->
