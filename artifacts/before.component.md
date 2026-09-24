# Component Diagram (before)

**Base:** `29c736e` — fix(factory): beads/github id confusion (Jo Van Eyck, 2026-09-14)

```mermaid
C4Component
  title Component Diagram (before) — 29c736e

  Container_Boundary(fe, "Frontend") {
    Component(progressReport, "ProgressReport", "TSX", "Progress page: pick dog + training, score graph")
  }

  Container_Boundary(be, "Backend (Express)") {
    Component(createApp, "createApp", "TS", "Wires repositories and routers")
    Component(sessionRoutes, "sessionRoutes", "TS", "Session HTTP routes")
    Component(sessionListingService, "SessionListingService", "TS", "Lists sessions in a date range")
    Component(sessionRepository, "SessionRepository", "TS", "Session persistence interface")
    Component(dogRepository, "DogRepository", "TS", "Dog persistence")
    Component(trainingRepository, "TrainingRepository", "TS", "Training persistence")
  }

  Rel(progressReport, sessionRoutes, "GET sessions", "/api/dogs/:id/sessions")
  Rel(createApp, sessionRoutes, "mounts")
  Rel(sessionRoutes, sessionListingService, "list()")
  Rel(sessionRoutes, sessionRepository, "getById/save/delete")
  Rel(sessionRoutes, dogRepository, "getById")
  Rel(sessionListingService, sessionRepository, "getByDogIdInRange")
```

## Evidence
- `sessionRoutes` receives `(dogRepo, sessionRepo, sessionListingService)` in `createApp.ts`.
- `SessionRepository` interface exposes `getById`, `getByDogIdInRange`, `save`, `delete`.
- `ProgressReport.tsx` fetches `/api/dogs/:id/sessions?from&to`.

## Summary
Baseline: the Progress page reads range-filtered sessions; `sessionRoutes` depends on the listing service, session and dog repositories. There is no CSV export and no `TrainingRepository` wiring into `sessionRoutes`.
