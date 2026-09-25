# Component Diagram (before)

**Base:** `098efcf` — opus owner (Jo Van Eyck, 2026-09-25)
**Head:** `0f80f34` — fix: address SonarCloud feedback (jo-clank, 2026-09-25)

```mermaid
C4Component
  title Component Before — opus owner (098efcf)

  Container_Boundary(fe, "Frontend (React)") {
    Component(progressReport, "ProgressReport", "TSX", "Progress report per dog/training")
  }
  Container_Boundary(be, "Backend (Express)") {
    Component(createApp, "createApp", "TS", "Composition root")
    Component(sessionRoutes, "sessionRoutes", "Express Router", "Session API")
    Component(sessionRepo, "SessionRepository / FsSessionRepository", "TS", "Session persistence")
    Component(dogRepo, "DogRepository", "TS", "Dog persistence")
    Component(trainingRepo, "TrainingRepository", "TS", "Training persistence")
  }

  Rel(progressReport, sessionRoutes, "fetches", "GET /api/dogs/:id/sessions")
  Rel(createApp, sessionRoutes, "mounts")
  Rel(sessionRoutes, sessionRepo, "reads/writes")
  Rel(sessionRoutes, dogRepo, "reads")
```
