# Component Diagram (before)

**Base:** `c0cc5b0` — model routing: deepseek + opus (Jo Van Eyck, 2026-10-04)
**Head:** `7293159` — fix: address SonarCloud feedback (jo-clank, 2026-10-04) — tip of PR #38 `feat/37` source changes

```mermaid
C4Component
  title Components (before) — model routing: deepseek + opus (c0cc5b0)

  Container_Boundary(fe, "Frontend (React)") {
    Component(dogProfile, "DogProfile", "TSX", "Dog profile page")
    Component(progressView, "ProgressView", "TSX", "Weekly session agenda")
  }
  Container_Boundary(be, "Backend (Express)") {
    Component(createApp, "createApp", "TS", "Composition root")
    Component(sessionRoutes, "sessionRoutes", "TS", "Sessions HTTP adapter")
    Component(listing, "SessionListingService", "TS", "Merges persisted + planned sessions")
    Component(dogRepo, "DogRepository", "TS", "Dog persistence")
    Component(sessionRepo, "SessionRepository", "TS", "Session persistence")
    Component(planRepo, "PlanRepository", "TS", "Plan persistence")
  }

  Rel(dogProfile, progressView, "renders")
  Rel(progressView, sessionRoutes, "GET /api/dogs/:dogId/sessions", "HTTP")
  Rel(createApp, sessionRoutes, "mounts")
  Rel(createApp, listing, "constructs")
  Rel(sessionRoutes, listing, "lists via", "list()")
  Rel(sessionRoutes, dogRepo, "reads")
  Rel(sessionRoutes, sessionRepo, "reads/writes")
  Rel(listing, dogRepo, "reads")
  Rel(listing, planRepo, "reads")
  Rel(listing, sessionRepo, "reads")
```

## Evidence
- `app/backend/createApp.ts` — `sessionRoutes(dogRepo, sessionRepo, sessionListingService)`.
- `app/backend/sessions/SessionListingService.ts` — constructor(dogs, plans, sessions).
- `app/frontend/src/DogProfile.tsx` — renders `<ProgressView>` inside the "Sessions" section.
