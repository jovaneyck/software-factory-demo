# Component Diagram (after)

**Base:** `6d8309b` — beads (Jo Van Eyck, 2026-09-25)
**Head:** `f070a89` — fix: address SonarCloud feedback (jo-clank, 2026-09-25)

```mermaid
C4Component
  title Components — fix: address SonarCloud feedback (f070a89)

  Container_Boundary(fe, "Frontend (React)") {
    Component(progressReport, "ProgressReport", "TSX", "Progress screen with CSV export action")
    Component(progressCsv, "progressCsv", "TS", "Builds escaped CSV from sessions")
    Component(progressGraph, "ProgressGraph", "TSX", "Score chart")
    Component(dogTile, "DogTile", "TSX", "Dog picker tile")
  }
  Container_Ext(api, "Backend API", "Express", "/api/dogs, /api/trainings, sessions")

  Rel(progressReport, progressCsv, "builds CSV via", "buildProgressCsv()")
  Rel(progressReport, progressGraph, "renders")
  Rel(progressReport, dogTile, "renders")
  Rel(progressReport, api, "fetches", "fetch('/api/...')")
```

## Evidence
- `app/frontend/src/progressCsv.ts` exports `buildProgressCsv`, imported by `ProgressReport.tsx`.
