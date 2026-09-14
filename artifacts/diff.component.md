# Component Diagram (diff)

**Base:** `961e4be` — chore(factory): set worker/feature-owner/reviewer/merger tiers to deepseek (Jo Van Eyck, 2026-09-14)
**Head:** `62fe3a2` — fix: address review feedback (CSV formula injection) (jo-clank, 2026-09-14)

```mermaid
C4Component
  title Component Diff — CSV export (961e4be vs 62fe3a2)

  Container_Boundary(api, "DogTrainr API (Express)") {
    Component(createApp, "[~] createApp", "TS", "Composition root: builds repos, services, routes")
    Component(sessionRoutes, "[~] sessionRoutes", "TS", "Session HTTP routes + sessions.csv")
    Component(sessionListing, "SessionListingService", "TS", "Merges persisted + planned sessions")
    Component(sessionCsv, "[+] SessionCsvExporter", "TS", "Builds RFC 4180 CSV export")
    Component(dogRepo, "DogRepository", "TS", "Dog persistence")
    Component(trainingRepo, "TrainingRepository", "TS", "Training persistence")
    Component(sessionRepo, "SessionRepository", "TS", "Session persistence")
  }

  Container_Boundary(spa, "DogTrainr SPA (React)") {
    Component(dogProfile, "[~] DogProfile", "TSX", "Dog profile page + Export CSV link")
  }

  Rel(createApp, sessionRoutes, "wires")
  Rel(createApp, sessionListing, "constructs")
  Rel(createApp, sessionCsv, "constructs")
  Rel(sessionRoutes, sessionListing, "lists via")
  Rel(sessionRoutes, sessionCsv, "exports via")
  Rel(sessionCsv, dogRepo, "reads via")
  Rel(sessionCsv, trainingRepo, "reads via")
  Rel(sessionCsv, sessionRepo, "reads via")
  Rel(sessionListing, dogRepo, "reads via")
  Rel(dogProfile, sessionRoutes, "downloads CSV from")

  UpdateElementStyle(createApp, $bgColor="#fff5b1", $borderColor="#b08800", $fontColor="#735c0f")
  UpdateElementStyle(sessionRoutes, $bgColor="#fff5b1", $borderColor="#b08800", $fontColor="#735c0f")
  UpdateElementStyle(dogProfile, $bgColor="#fff5b1", $borderColor="#b08800", $fontColor="#735c0f")
  UpdateElementStyle(sessionCsv, $bgColor="#e6ffed", $borderColor="#22863a", $fontColor="#22863a")

  UpdateRelStyle(createApp, sessionCsv, $lineColor="#22863a", $textColor="#22863a")
  UpdateRelStyle(sessionRoutes, sessionCsv, $lineColor="#22863a", $textColor="#22863a")
  UpdateRelStyle(sessionCsv, dogRepo, $lineColor="#22863a", $textColor="#22863a")
  UpdateRelStyle(sessionCsv, trainingRepo, $lineColor="#22863a", $textColor="#22863a")
  UpdateRelStyle(sessionCsv, sessionRepo, $lineColor="#22863a", $textColor="#22863a")
  UpdateRelStyle(dogProfile, sessionRoutes, $lineColor="#22863a", $textColor="#22863a")
```

## Legend
🟢 added  🔴 removed  🟠 changed  ⚪ unchanged (context)

## Evidence
- 🟢 `SessionCsvExporter` — new component in `app/backend/sessions/SessionCsvExporter.ts`; depends on `DogRepository`, `TrainingRepository`, `SessionRepository` (constructor types).
- 🟢 `createApp → SessionCsvExporter` — `new SessionCsvExporter(dogRepo, trainingRepo, sessionRepo)` in `app/backend/createApp.ts`.
- 🟢 `sessionRoutes → SessionCsvExporter` — new `sessions.csv` handler calls `exporter.export(...)` in `app/backend/sessions/sessionRoutes.ts`.
- 🟢 `SessionCsvExporter → *Repository` — reads via `dogs.getById`, `trainings.getAll`, `sessions.getByDogIdInRange` in `SessionCsvExporter.ts`.
- 🟢 `DogProfile → sessionRoutes` — new `GET /api/dogs/:id/sessions.csv` link in `app/frontend/src/DogProfile.tsx`.
- 🟠 `createApp` — constructor wiring changed to inject the exporter into `sessionRoutes`.
- 🟠 `sessionRoutes` — signature gained `exporter: SessionCsvExporter`; added the CSV route.
- 🟠 `DogProfile` — header block changed to include the export link.

## Summary
One new component, `SessionCsvExporter`, is added to the backend and wired through `createApp` into `sessionRoutes`; it reads the dog, training, and session repositories to emit an RFC 4180 CSV. `sessionRoutes` gains the `GET /api/dogs/:dogId/sessions.csv` endpoint, and `DogProfile` gains a link that calls it. No components were removed and no existing repository/service dependencies were dropped — the change is purely additive plus three configuration/wiring edits.
