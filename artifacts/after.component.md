# Component Diagram (after)

**Base:** `fe5a1a1` — use luna 6 (Jo Van Eyck, 2026-09-24)
**Head:** `9daac39` — csv export (jo-clank, 2026-09-24)

```mermaid
C4Component
  title After — csv export (9daac39)

  Container_Boundary(frontend, "Frontend") {
    Component(progressReport, "ProgressReport", "React", "Selects dog/training, filters graph, downloads CSV")
    Component(progressGraph, "ProgressGraph", "React", "Plots training sessions")
  }

  Container_Boundary(backend, "Backend") {
    Component(appFactory, "createApp", "Express", "Builds repositories and registers API routes")
    Component(sessionRoutes, "sessionRoutes", "Express Router", "Lists sessions and streams filtered CSV exports")
    Component(dogRepository, "DogRepository", "Repository", "Loads dog records")
    Component(sessionRepository, "SessionRepository", "Repository", "Loads and persists sessions")
    Component(sessionListing, "SessionListingService", "Service", "Combines persisted and scheduled sessions")
    Component(trainingRoutes, "trainingRoutes", "Express Router", "Serves training API")
    Component(trainingRepository, "TrainingRepository", "Repository", "Loads and persists training records")
  }

  Rel(progressReport, progressGraph, "renders")
  Rel(progressReport, sessionRoutes, "fetches sessions", "GET /api/dogs/:dogId/sessions")
  Rel(progressReport, sessionRoutes, "downloads CSV", "GET /api/dogs/:dogId/sessions/export?from=&to=")
  Rel(appFactory, sessionRoutes, "registers", "sessionRoutes(dogRepo, sessionRepo, sessionListingService, trainingRepo)")
  Rel(appFactory, trainingRoutes, "registers", "trainingRoutes(trainingRepo, trainingUpload)")
  Rel(trainingRoutes, trainingRepository, "reads/writes")
  Rel(sessionRoutes, dogRepository, "looks up dogs")
  Rel(sessionRoutes, sessionRepository, "reads/writes sessions")
  Rel(sessionRoutes, sessionListing, "lists sessions via")
  Rel(sessionRoutes, trainingRepository, "resolves training names", "trainings.getAll()")
```

## Evidence
- `ProgressReport.exportCsv` requests `/api/dogs/${selectedDogId}/sessions/export` with its active date range; `ProgressReport` also renders `ProgressGraph` (`app/frontend/src/ProgressReport.tsx`).
- `createApp` passes `trainingRepo` as the new fourth argument to `sessionRoutes` (`app/backend/createApp.ts`, `createApp`).
- The export handler calls `trainings.getAll()` to map training IDs to names and reads dog/session repositories (`app/backend/sessions/sessionRoutes.ts`, `sessionRoutes` and `GET /dogs/:dogId/sessions/export`).
- Existing training-route wiring remains through `trainingRoutes(trainingRepo, trainingUpload)` (`app/backend/createApp.ts`, `createApp`; `app/backend/trainings/trainingRoutes.ts`, `trainingRoutes`).

## Summary
The after-state adds a progress-report CSV download path into the existing session router. The router now receives `TrainingRepository` to label session rows with training names; the app factory's session-router wiring changes to provide that dependency. Existing graph rendering and session listing paths remain.
