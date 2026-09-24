# Component Diagram (after)

**Head:** `518c690` — fix: address review feedback (Jo Van Eyck, 2026-09-14)

```mermaid
C4Component
  title Component Diagram (after) — 518c690

  Container_Boundary(fe, "Frontend") {
    Component(progressReport, "ProgressReport", "TSX", "Progress page + Export CSV link")
  }

  Container_Boundary(be, "Backend (Express)") {
    Component(createApp, "createApp", "TS", "Wires repositories and routers")
    Component(sessionRoutes, "sessionRoutes", "TS", "Session HTTP routes incl. /export")
    Component(sessionCsv, "sessionCsv", "TS", "Pure CSV generation + filename helpers")
    Component(sessionListingService, "SessionListingService", "TS", "Lists sessions in a date range")
    Component(sessionRepository, "SessionRepository", "TS", "Session persistence interface")
    Component(dogRepository, "DogRepository", "TS", "Dog persistence")
    Component(trainingRepository, "TrainingRepository", "TS", "Training persistence")
  }

  Rel(progressReport, sessionRoutes, "GET sessions + Export CSV", "/api/dogs/:id/sessions[/export]")
  Rel(createApp, sessionRoutes, "mounts")
  Rel(sessionRoutes, sessionListingService, "list()")
  Rel(sessionRoutes, sessionCsv, "sessionsToCsv/csvFilename")
  Rel(sessionRoutes, sessionRepository, "getById/getByDogId/save/delete")
  Rel(sessionRoutes, dogRepository, "getById")
  Rel(sessionRoutes, trainingRepository, "getAll")
  Rel(sessionListingService, sessionRepository, "getByDogIdInRange")
```

## Evidence
- New `sessionCsv.ts` exports `escapeCsvField`, `sessionsToCsv`, `csvFilename`; imported by `sessionRoutes.ts`.
- `sessionRoutes` now receives `trainingRepo` (`createApp.ts`) and calls `trainings.getAll()` in the export route.
- `SessionRepository` gained `getByDogId(dogId)`; export route uses `sessions.getByDogId(dogId)`.
- `ProgressReport.tsx` adds an Export CSV link to `/api/dogs/:id/sessions/export`.

## Summary
Adds a `sessionCsv` component and an `/export` route; `sessionRoutes` now depends on `sessionCsv` and `TrainingRepository`, and the Progress page gains a CSV download link.
