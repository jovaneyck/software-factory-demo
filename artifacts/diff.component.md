# Component Diagram (diff)

**Base:** `098efcf` — opus owner (Jo Van Eyck, 2026-09-25)
**Head:** `0f80f34` — fix: address SonarCloud feedback (jo-clank, 2026-09-25)

```mermaid
C4Component
  title Component Diff — fix: address SonarCloud feedback (0f80f34) vs opus owner (098efcf)

  Container_Boundary(fe, "Frontend (React)") {
    Component(progressReport, "[~] ProgressReport", "TSX", "Progress report + Export CSV button")
  }
  Container_Boundary(be, "Backend (Express)") {
    Component(createApp, "[~] createApp", "TS", "Composition root")
    Component(sessionRoutes, "sessionRoutes", "Express Router", "Session API")
    Component(exportRoutes, "[+] progressExportRoutes", "Express Router", "GET /api/dogs/:id/progress.csv")
    Component(exportService, "[+] TrainingProgressExportService", "TS", "Builds CSV of completed/skipped sessions")
    Component(sessionRepo, "[~] SessionRepository / FsSessionRepository", "TS", "Session persistence (+getByDogId)")
    Component(dogRepo, "DogRepository", "TS", "Dog persistence")
    Component(trainingRepo, "TrainingRepository", "TS", "Training persistence")
  }

  Rel(progressReport, sessionRoutes, "fetches", "GET /api/dogs/:id/sessions")
  Rel(progressReport, exportRoutes, "downloads", "GET /api/dogs/:id/progress.csv")
  Rel(createApp, sessionRoutes, "mounts")
  Rel(createApp, exportRoutes, "mounts")
  Rel(createApp, exportService, "instantiates")
  Rel(sessionRoutes, sessionRepo, "reads/writes")
  Rel(sessionRoutes, dogRepo, "reads")
  Rel(exportRoutes, exportService, "calls", "exportForDog(id)")
  Rel(exportService, dogRepo, "reads", "getById")
  Rel(exportService, trainingRepo, "reads", "getAll")
  Rel(exportService, sessionRepo, "reads", "getByDogId")

  UpdateElementStyle(exportRoutes, $bgColor="#e6ffed", $borderColor="#22863a", $fontColor="#22863a")
  UpdateElementStyle(exportService, $bgColor="#e6ffed", $borderColor="#22863a", $fontColor="#22863a")
  UpdateElementStyle(progressReport, $bgColor="#fff5b1", $borderColor="#b08800", $fontColor="#735c0f")
  UpdateElementStyle(createApp, $bgColor="#fff5b1", $borderColor="#b08800", $fontColor="#735c0f")
  UpdateElementStyle(sessionRepo, $bgColor="#fff5b1", $borderColor="#b08800", $fontColor="#735c0f")
  UpdateRelStyle(progressReport, exportRoutes, $lineColor="#22863a", $textColor="#22863a")
  UpdateRelStyle(createApp, exportRoutes, $lineColor="#22863a", $textColor="#22863a")
  UpdateRelStyle(createApp, exportService, $lineColor="#22863a", $textColor="#22863a")
  UpdateRelStyle(exportRoutes, exportService, $lineColor="#22863a", $textColor="#22863a")
  UpdateRelStyle(exportService, dogRepo, $lineColor="#22863a", $textColor="#22863a")
  UpdateRelStyle(exportService, trainingRepo, $lineColor="#22863a", $textColor="#22863a")
  UpdateRelStyle(exportService, sessionRepo, $lineColor="#22863a", $textColor="#22863a")
```

## Legend
🟢 added  🔴 removed  🟠 changed  ⚪ unchanged (context)

## Evidence
- 🟢 `progressExportRoutes` — new `app/backend/sessions/progressExportRoutes.ts`; `router.get('/dogs/:id/progress.csv')` calls `service.exportForDog`.
- 🟢 `TrainingProgressExportService` — new `app/backend/sessions/TrainingProgressExportService.ts`; constructor takes `DogRepository`, `TrainingRepository`, `SessionRepository`.
- 🟠 `createApp` — `app/backend/createApp.ts` instantiates `TrainingProgressExportService` and mounts `progressExportRoutes` under `/api`.
- 🟠 `SessionRepository` — `getByDogId(dogId)` added to the interface, `FsSessionRepository` and `FakeSessionRepository`.
- 🟠 `ProgressReport` — `app/frontend/src/ProgressReport.tsx` `exportProgress()` fetches `/api/dogs/${id}/progress.csv` and triggers a blob download.

## Summary
New: a backend CSV export endpoint (`progressExportRoutes`) backed by `TrainingProgressExportService`, which combines dog, training and session data into a per-session CSV of completed/skipped sessions. Nothing was removed. Changed relationships: `createApp` wires the new service/router, `SessionRepository` gains `getByDogId`, and the frontend `ProgressReport` now calls the new endpoint.
