# Component Diagram (before)

**Base:** `26e3e28` — herdr workaround for foreman poke (Jo Van Eyck, 2026-08-31)

```mermaid
C4Component
  title Component Diagram — before (26e3e28)

  Container_Boundary(backend, "Backend") {
    Component(createApp, "createApp", "TS", "Wires repos, services, and routes")
    Component(sessionRoutes, "sessionRoutes", "TS", "REST endpoints for sessions")
    Component(sessionListingService, "SessionListingService", "TS", "Merges schedule + persisted sessions")
    Component(sessionRepository, "SessionRepository", "TS interface", "Persistence for sessions")
    Component(dogRepository, "DogRepository", "TS interface", "Persistence for dogs")
    Component(planRepository, "PlanRepository", "TS interface", "Persistence for plans")
    Component(trainingRepository, "TrainingRepository", "TS interface", "Persistence for trainings")
    Component(validateUuid, "validateUuid", "TS", "UUID param middleware")
  }

  Container_Boundary(frontend, "Frontend") {
    Component(progressReport, "ProgressReport", "React", "Progress reporting page")
  }

  Rel(createApp, sessionRoutes, "mounts")
  Rel(sessionRoutes, dogRepository, "reads dogs")
  Rel(sessionRoutes, sessionRepository, "reads/writes sessions")
  Rel(sessionRoutes, sessionListingService, "lists sessions")
  Rel(sessionRoutes, validateUuid, "validates params")
  Rel(sessionListingService, dogRepository, "reads dogs")
  Rel(sessionListingService, planRepository, "reads plans")
  Rel(sessionListingService, sessionRepository, "reads sessions")
  Rel(progressReport, sessionRoutes, "fetches sessions via /api")
```

## Evidence
- `createApp` — `app/backend/createApp.ts`: `app.use('/api', sessionRoutes(dogRepo, sessionRepo, sessionListingService))`
- `sessionRoutes` — `app/backend/sessions/sessionRoutes.ts`: accepts `DogRepository`, `SessionRepository`, `SessionListingService`
- `SessionListingService` — `app/backend/sessions/SessionListingService.ts`: injected with `DogRepository`, `PlanRepository`, `SessionRepository`
- `SessionRepository` — `app/backend/sessions/SessionRepository.ts`: interface with `getById`, `getByDogIdInRange`, `save`, `delete`
- `ProgressReport` — `app/frontend/src/ProgressReport.tsx`: fetches `/api/dogs/:dogId/sessions`
