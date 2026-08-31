# Component Diagram (after)

**Head:** `ee0ca2d` — fix(sessions): validate date filters and sanitize export filename (Jo Van Eyck, 2026-08-31)

```mermaid
C4Component
  title Component Diagram — after (ee0ca2d)

  Container_Boundary(backend, "Backend") {
    Component(createApp, "createApp", "TS", "Wires repos, services, and routes")
    Component(sessionRoutes, "sessionRoutes", "TS", "REST endpoints for sessions + CSV export")
    Component(sessionListingService, "SessionListingService", "TS", "Merges schedule + persisted sessions")
    Component(sessionRepository, "SessionRepository", "TS interface", "Persistence for sessions")
    Component(dogRepository, "DogRepository", "TS interface", "Persistence for dogs")
    Component(planRepository, "PlanRepository", "TS interface", "Persistence for plans")
    Component(trainingRepository, "TrainingRepository", "TS interface", "Persistence for trainings")
    Component(validateUuid, "validateUuid", "TS", "UUID param middleware")
  }

  Container_Boundary(frontend, "Frontend") {
    Component(progressReport, "ProgressReport", "React", "Progress reporting page with CSV export link")
  }

  Rel(createApp, sessionRoutes, "mounts")
  Rel(sessionRoutes, dogRepository, "reads dogs")
  Rel(sessionRoutes, sessionRepository, "reads/writes sessions")
  Rel(sessionRoutes, sessionListingService, "lists sessions")
  Rel(sessionRoutes, trainingRepository, "resolves training names")
  Rel(sessionRoutes, validateUuid, "validates params")
  Rel(sessionListingService, dogRepository, "reads dogs")
  Rel(sessionListingService, planRepository, "reads plans")
  Rel(sessionListingService, sessionRepository, "reads sessions")
  Rel(progressReport, sessionRoutes, "fetches sessions + CSV export via /api")
```

## Evidence
- `createApp` — `app/backend/createApp.ts`: `app.use('/api', sessionRoutes(dogRepo, sessionRepo, sessionListingService, trainingRepo))`
- `sessionRoutes` — `app/backend/sessions/sessionRoutes.ts`: now accepts optional `TrainingRepository`; new `GET /dogs/:dogId/sessions/export` endpoint calls `sessions.getByDogId()` and `trainings.getAll()`
- `SessionRepository` — `app/backend/sessions/SessionRepository.ts`: interface gained `getByDogId(dogId: string): Session[]`
- `ProgressReport` — `app/frontend/src/ProgressReport.tsx`: added `<a href="/api/dogs/${selectedDogId}/sessions/export">` export link
