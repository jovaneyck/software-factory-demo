# Component Diagram (diff)

**Base:** `fe5a1a1` — use luna 6 (Jo Van Eyck, 2026-09-24)
**Head:** `9daac39` — csv export (jo-clank, 2026-09-24)

```mermaid
C4Component
  title Component Diff — csv export (9daac39) vs use luna 6 (fe5a1a1)

  Container_Boundary(frontend, "Frontend") {
    Component(progressReport, "[~] ProgressReport", "React", "Selects dog/training, filters graph, downloads CSV")
    Component(progressGraph, "ProgressGraph", "React", "Plots training sessions")
  }

  Container_Boundary(backend, "Backend") {
    Component(appFactory, "[~] createApp", "Express", "Builds repositories and registers API routes")
    Component(sessionRoutes, "[~] sessionRoutes", "Express Router", "Lists sessions and streams filtered CSV exports")
    Component(dogRepository, "DogRepository", "Repository", "Loads dog records")
    Component(sessionRepository, "SessionRepository", "Repository", "Loads and persists sessions")
    Component(sessionListing, "SessionListingService", "Service", "Combines persisted and scheduled sessions")
    Component(trainingRoutes, "trainingRoutes", "Express Router", "Serves training API")
    Component(trainingRepository, "TrainingRepository", "Repository", "Loads and persists training records")
  }

  Rel(progressReport, progressGraph, "renders")
  Rel(progressReport, sessionRoutes, "requests sessions and CSV export", "GET /api/dogs/:dogId/sessions[/export]")
  Rel(appFactory, sessionRoutes, "registers", "sessionRoutes(..., trainingRepo)")
  Rel(appFactory, trainingRoutes, "registers", "trainingRoutes(trainingRepo, trainingUpload)")
  Rel(trainingRoutes, trainingRepository, "reads/writes")
  Rel(sessionRoutes, dogRepository, "looks up dogs")
  Rel(sessionRoutes, sessionRepository, "reads/writes sessions")
  Rel(sessionRoutes, sessionListing, "lists sessions via")
  Rel(sessionRoutes, trainingRepository, "resolves training names", "trainings.getAll()")

  UpdateElementStyle(progressReport, $bgColor="#fff5b1", $borderColor="#b08800", $fontColor="#735c0f")
  UpdateElementStyle(appFactory, $bgColor="#fff5b1", $borderColor="#b08800", $fontColor="#735c0f")
  UpdateElementStyle(sessionRoutes, $bgColor="#fff5b1", $borderColor="#b08800", $fontColor="#735c0f")
  UpdateRelStyle(progressReport, sessionRoutes, $lineColor="#b08800", $textColor="#735c0f")
  UpdateRelStyle(appFactory, sessionRoutes, $lineColor="#b08800", $textColor="#735c0f")
  UpdateRelStyle(sessionRoutes, trainingRepository, $lineColor="#22863a", $textColor="#22863a")
```

## Legend
🟢 added  🔴 removed  🟠 changed  ⚪ unchanged (context)

## Evidence
- 🟠 `ProgressReport` — added export state/handler and the CSV download request while retaining graph rendering (`app/frontend/src/ProgressReport.tsx`, `ProgressReport.exportCsv`).
- 🟠 `ProgressReport` → `sessionRoutes` — existing session-list request gains a CSV-export operation (`GET /api/dogs/:dogId/sessions/export`, `app/frontend/src/ProgressReport.tsx`, `exportCsv`; `app/backend/sessions/sessionRoutes.ts`, export route).
- 🟠 `createApp` → `sessionRoutes` — registration call now passes `trainingRepo` (`app/backend/createApp.ts`, `createApp`).
- 🟠 `sessionRoutes` — receives `TrainingRepository` and handles the CSV response (`app/backend/sessions/sessionRoutes.ts`, `sessionRoutes`).
- 🟢 `sessionRoutes` → `TrainingRepository` — export calls `trainings.getAll()` to resolve training names (`app/backend/sessions/sessionRoutes.ts`, `GET /dogs/:dogId/sessions/export`).

## Summary
The change adds no components and removes none. It changes the `ProgressReport`, app-factory wiring, and session-router components: the frontend can now request a CSV export, and the session router gains a `TrainingRepository` dependency to resolve training names. The existing dog/session repositories, listing service, training routes, and graph component remain as context.
