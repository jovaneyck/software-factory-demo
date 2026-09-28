# Component Diagram (diff)

**Base:** `39cd615` — live preview (Jo Van Eyck, 2026-09-23)
**Head:** `603c7ec` — fix: address SonarCloud feedback (jo-clank, 2026-09-23)

```mermaid
C4Component
  title Component Diff — Surprise training (603c7ec vs 39cd615)

  Container_Boundary(be, "Backend") {
    Component(createApp, "[~] createApp", "TS", "Wires services and routes")
    Component(surpriseService, "[+] SurpriseTrainingService", "TS", "Picks the longest-unperformed training")
    Component(surpriseRoutes, "[+] surpriseTrainingRoutes", "TS", "GET /dogs/:dogId/trainings/surprise")
    Component(dogRepo, "DogRepository", "TS", "Dog persistence")
    Component(trainingRepo, "TrainingRepository", "TS", "Training persistence")
    Component(sessionRepo, "[~] SessionRepository", "TS", "Session persistence interface")
    Component(fsSessionRepo, "[~] FsSessionRepository", "TS", "File-backed session store")
    Component(fakeSessionRepo, "[~] FakeSessionRepository", "TS", "In-memory session store")
  }

  Container_Boundary(fe, "Frontend") {
    Component(dogList, "[~] DogList", "TSX", "Home page dog list")
    Component(dogTile, "DogTile", "TSX", "Dog card")
    Component(dogProfile, "[~] DogProfile", "TSX", "Dog detail page")
    Component(surpriseModal, "[+] SurpriseTrainingModal", "TSX", "Fetches and pops up the surprise training")
    Component(sessionSheet, "[+] SessionSheet", "TSX", "Shared registration sheet")
    Component(modalShell, "[+] ModalShell", "TSX", "Shared accessible modal overlay")
    Component(progressView, "[~] ProgressView", "TSX", "Weekly progress")
  }

  Rel(createApp, surpriseService, "instantiates")
  Rel(createApp, surpriseRoutes, "mounts")
  Rel(createApp, dogRepo, "injects")
  Rel(createApp, trainingRepo, "injects")
  Rel(surpriseRoutes, surpriseService, "calls find()")
  Rel(surpriseRoutes, dogRepo, "validates dog via getById()")
  Rel(surpriseService, trainingRepo, "reads via getAll()")
  Rel(surpriseService, sessionRepo, "reads via getByDogId()")
  Rel(fsSessionRepo, sessionRepo, "implements")
  Rel(fakeSessionRepo, sessionRepo, "implements")

  Rel(dogList, dogProfile, "Surprise me links to /dogs/:id?surprise=1")
  Rel(dogList, dogTile, "renders")
  Rel(dogProfile, surpriseModal, "renders when ?surprise=1")
  Rel(dogProfile, progressView, "renders")
  Rel(surpriseModal, sessionSheet, "reuses registration sheet")
  Rel(surpriseModal, modalShell, "loading and empty states")
  Rel(sessionSheet, modalShell, "wraps content")
  Rel(progressView, sessionSheet, "reuses registration sheet")

  UpdateElementStyle(surpriseService, $bgColor="#e6ffed", $borderColor="#22863a", $fontColor="#22863a")
  UpdateElementStyle(surpriseRoutes, $bgColor="#e6ffed", $borderColor="#22863a", $fontColor="#22863a")
  UpdateElementStyle(surpriseModal, $bgColor="#e6ffed", $borderColor="#22863a", $fontColor="#22863a")
  UpdateElementStyle(sessionSheet, $bgColor="#e6ffed", $borderColor="#22863a", $fontColor="#22863a")
  UpdateElementStyle(modalShell, $bgColor="#e6ffed", $borderColor="#22863a", $fontColor="#22863a")
  UpdateElementStyle(createApp, $bgColor="#fff5b1", $borderColor="#b08800", $fontColor="#735c0f")
  UpdateElementStyle(sessionRepo, $bgColor="#fff5b1", $borderColor="#b08800", $fontColor="#735c0f")
  UpdateElementStyle(fsSessionRepo, $bgColor="#fff5b1", $borderColor="#b08800", $fontColor="#735c0f")
  UpdateElementStyle(fakeSessionRepo, $bgColor="#fff5b1", $borderColor="#b08800", $fontColor="#735c0f")
  UpdateElementStyle(dogList, $bgColor="#fff5b1", $borderColor="#b08800", $fontColor="#735c0f")
  UpdateElementStyle(dogProfile, $bgColor="#fff5b1", $borderColor="#b08800", $fontColor="#735c0f")
  UpdateElementStyle(progressView, $bgColor="#fff5b1", $borderColor="#b08800", $fontColor="#735c0f")

  UpdateRelStyle(createApp, surpriseService, $lineColor="#22863a", $textColor="#22863a")
  UpdateRelStyle(createApp, surpriseRoutes, $lineColor="#22863a", $textColor="#22863a")
  UpdateRelStyle(surpriseRoutes, surpriseService, $lineColor="#22863a", $textColor="#22863a")
  UpdateRelStyle(surpriseRoutes, dogRepo, $lineColor="#22863a", $textColor="#22863a")
  UpdateRelStyle(surpriseService, trainingRepo, $lineColor="#22863a", $textColor="#22863a")
  UpdateRelStyle(surpriseService, sessionRepo, $lineColor="#22863a", $textColor="#22863a")
  UpdateRelStyle(surpriseModal, sessionSheet, $lineColor="#22863a", $textColor="#22863a")
  UpdateRelStyle(surpriseModal, modalShell, $lineColor="#22863a", $textColor="#22863a")
  UpdateRelStyle(sessionSheet, modalShell, $lineColor="#22863a", $textColor="#22863a")
  UpdateRelStyle(progressView, sessionSheet, $lineColor="#22863a", $textColor="#22863a")
  UpdateRelStyle(dogList, dogProfile, $lineColor="#b08800", $textColor="#735c0f")
  UpdateRelStyle(dogProfile, surpriseModal, $lineColor="#b08800", $textColor="#735c0f")
```

## Legend
🟢 added  🔴 removed  🟠 changed  ⚪ unchanged (context)

## Evidence
- 🟢 `SurpriseTrainingService` — new `app/backend/trainings/SurpriseTrainingService.ts`; `find()` reads `trainings.getAll()` + `sessions.getByDogId(dogId)`.
- 🟢 `surpriseTrainingRoutes` — new `app/backend/trainings/surpriseTrainingRoutes.ts`; exposes `GET /dogs/:dogId/trainings/surprise`, calls `service.find(dogId)`.
- 🟢 `SurpriseTrainingModal` — new `app/frontend/src/SurpriseTrainingModal.tsx`; renders `SessionSheet` and `ModalShell`.
- 🟢 `SessionSheet` — new `app/frontend/src/SessionSheet.tsx`; extracted registration form using `ModalShell`.
- 🟢 `ModalShell` — new `app/frontend/src/ModalShell.tsx`; shared accessible overlay.
- 🟠 `createApp` — `app/backend/createApp.ts`; now constructs `SurpriseTrainingService` and mounts `surpriseTrainingRoutes`.
- 🟠 `SessionRepository` — `app/backend/sessions/SessionRepository.ts`; added `getByDogId(dogId)`.
- 🟠 `FsSessionRepository` / `FakeSessionRepository` — added `getByDogId` implementations.
- 🟠 `DogList` — `app/frontend/src/DogList.tsx`; independent `/api/trainings` fetch and per-dog `Surprise me` link to `/dogs/:id?surprise=1`.
- 🟠 `DogProfile` — `app/frontend/src/DogProfile.tsx`; `Surprise me` button, `SurpriseTrainingModal`, keyed `ProgressView` refresh.
- 🟠 `ProgressView` — `app/frontend/src/ProgressView.tsx`; replaced inline registration sheet with `SessionSheet`.

## Summary
**New parts:** a backend `SurpriseTrainingService` + `surpriseTrainingRoutes` exposing `GET /api/dogs/:dogId/trainings/surprise`; and frontend `SurpriseTrainingModal` plus shared `SessionSheet`/`ModalShell`. **Removed:** nothing at component level — the inline registration sheet in `ProgressView` is replaced by the extracted `SessionSheet`. **Changed relationships:** `createApp` now instantiates the surprise service and mounts its routes; `SessionRepository` gained `getByDogId` (both implementations updated); `DogList` and `DogProfile` gain "Surprise me" entry points; `SurpriseTrainingModal` reuses `SessionSheet`/`ModalShell`, and `ProgressView` now reuses `SessionSheet`.