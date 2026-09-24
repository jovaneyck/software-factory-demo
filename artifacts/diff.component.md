# Component Diagram (diff)

**Base:** `29c736e` — fix(factory): beads/github id confusion (Jo Van Eyck, 2026-09-14)
**Head:** `518c690` — fix: address review feedback (Jo Van Eyck, 2026-09-14)

```mermaid
C4Component
  title Component Diff — CSV export (29c736e → 518c690)

  Container_Boundary(fe, "Frontend") {
    Component(progressReport, "[~] ProgressReport", "TSX", "Progress page + Export CSV link")
  }

  Container_Boundary(be, "Backend (Express)") {
    Component(createApp, "[~] createApp", "TS", "Wires repositories and routers")
    Component(sessionRoutes, "[~] sessionRoutes", "TS", "Session HTTP routes incl. /export")
    Component(sessionCsv, "[+] sessionCsv", "TS", "Pure CSV generation + filename helpers")
    Component(sessionListingService, "SessionListingService", "TS", "Lists sessions in a date range")
    Component(sessionRepository, "[~] SessionRepository", "TS", "Session persistence interface")
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

  UpdateElementStyle(sessionCsv, $bgColor="#e6ffed", $borderColor="#22863a", $fontColor="#22863a")
  UpdateElementStyle(sessionRoutes, $bgColor="#fff5b1", $borderColor="#b08800", $fontColor="#735c0f")
  UpdateElementStyle(sessionRepository, $bgColor="#fff5b1", $borderColor="#b08800", $fontColor="#735c0f")
  UpdateElementStyle(progressReport, $bgColor="#fff5b1", $borderColor="#b08800", $fontColor="#735c0f")
  UpdateElementStyle(createApp, $bgColor="#fff5b1", $borderColor="#b08800", $fontColor="#735c0f")

  UpdateRelStyle(sessionRoutes, sessionCsv, $lineColor="#22863a", $textColor="#22863a")
  UpdateRelStyle(sessionRoutes, trainingRepository, $lineColor="#22863a", $textColor="#22863a")
```

## Legend
🟢 added  🔴 removed  🟠 changed  ⚪ unchanged (context)

## Evidence
- 🟢 `sessionCsv` — new component `app/backend/sessions/sessionCsv.ts` (`sessionsToCsv`, `csvFilename`, `escapeCsvField`); wired via import in `sessionRoutes.ts`.
- 🟢 `sessionRoutes → trainingRepository` — new edge: export route calls `trainings.getAll()`; `createApp.ts` now passes `trainingRepo`.
- 🟠 `sessionRoutes` — added `/dogs/:dogId/sessions/export` route; new deps on `sessionCsv` and `TrainingRepository`; uses `sessions.getByDogId`.
- 🟠 `SessionRepository` — interface gained `getByDogId(dogId)` (implemented in Fs + Fake repos) to export full history without date bounds.
- 🟠 `createApp` — `sessionRoutes(...)` call gains `trainingRepo` argument.
- 🟠 `ProgressReport` — added Export CSV link to `/api/dogs/:id/sessions/export`.

## Summary
New `sessionCsv` component encapsulates CSV rendering + filename derivation. `sessionRoutes` grows an export endpoint and now depends on `sessionCsv` and `TrainingRepository`; `SessionRepository` adds `getByDogId` so the export covers the dog's full persisted history (fixing the review's date-bound omission). Nothing was removed. The frontend Progress page adds a download link.
