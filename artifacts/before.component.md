# Component Diagram (before)

**Base:** `fe5a1a1` — use luna 6 (Jo Van Eyck, 2026-09-24)
**Head:** `9daac39` — csv export (jo-clank, 2026-09-24)

```mermaid
C4Component
  title Before — use luna 6 (fe5a1a1)

  Container_Boundary(frontend, "Frontend") {
    Component(progressReport, "ProgressReport", "React", "Selects dogs/trainings and displays progress")
    Component(progressGraph, "ProgressGraph", "React", "Plots training sessions")
  }

  Container_Boundary(backend, "Backend") {
    Component(appFactory, "createApp", "Express", "Builds repositories and registers API routes")
    Component(sessionRoutes, "sessionRoutes", "Express Router", "Lists and mutates dog sessions")
    Component(dogRepository, "DogRepository", "Repository", "Loads dog records")
    Component(sessionRepository, "SessionRepository", "Repository", "Loads and persists sessions")
    Component(sessionListing, "SessionListingService", "Service", "Combines persisted and scheduled sessions")
    Component(trainingRoutes, "trainingRoutes", "Express Router", "Serves training API")
    Component(trainingRepository, "TrainingRepository", "Repository", "Loads and persists training records")
  }

  Rel(progressReport, progressGraph, "renders")
  Rel(progressReport, sessionRoutes, "fetches sessions", "GET /api/dogs/:dogId/sessions")
  Rel(appFactory, sessionRoutes, "registers", "sessionRoutes(dogRepo, sessionRepo, sessionListingService)")
  Rel(appFactory, trainingRoutes, "registers", "trainingRoutes(trainingRepo, trainingUpload)")
  Rel(trainingRoutes, trainingRepository, "reads/writes")
  Rel(sessionRoutes, dogRepository, "looks up dogs")
  Rel(sessionRoutes, sessionRepository, "reads/writes sessions")
  Rel(sessionRoutes, sessionListing, "lists sessions via")
```

## Evidence
- `ProgressReport` renders `ProgressGraph` and fetches the dog session listing in `app/frontend/src/ProgressReport.tsx` (`ProgressReport`, session-listing `fetch`).
- `createApp` registers `sessionRoutes` with the dog repository, session repository, and listing service in `app/backend/createApp.ts` (`createApp`).
- `sessionRoutes` receives and calls its dog/session repositories and `SessionListingService` in `app/backend/sessions/sessionRoutes.ts` (`sessionRoutes`).
- `createApp` registers `trainingRoutes(trainingRepo, trainingUpload)`; `trainingRoutes` receives its repository in `app/backend/trainings/trainingRoutes.ts` (`trainingRoutes`).

## Summary
Before this change, the progress report could request session data and render a graph, while the backend session router served session APIs using the dog/session repositories and listing service. There was no CSV download request or session-router dependency on the training repository.
