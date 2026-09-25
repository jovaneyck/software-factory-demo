# Component Diagram (before)

**Base:** `6d8309b` — beads (Jo Van Eyck, 2026-09-25)
**Head:** `f070a89` — fix: address SonarCloud feedback (jo-clank, 2026-09-25)

```mermaid
C4Component
  title Components — beads (6d8309b)

  Container_Boundary(fe, "Frontend (React)") {
    Component(progressReport, "ProgressReport", "TSX", "Progress screen for a dog/training")
    Component(progressGraph, "ProgressGraph", "TSX", "Score chart")
    Component(dogTile, "DogTile", "TSX", "Dog picker tile")
  }
  Container_Ext(api, "Backend API", "Express", "/api/dogs, /api/trainings, sessions")

  Rel(progressReport, progressGraph, "renders")
  Rel(progressReport, dogTile, "renders")
  Rel(progressReport, api, "fetches", "fetch('/api/...')")
```

## Evidence
- `app/frontend/src/ProgressReport.tsx` imports `ProgressGraph`, `DogTile`; calls `fetch('/api/dogs')`, `/api/dogs/:id/sessions`, `/api/trainings`.
