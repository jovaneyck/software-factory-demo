# Component Diagram (before)

**Base:** `17ab2c9` — le format (Jo Van Eyck, 2026-08-27)

```mermaid
C4Component
  title Component Diagram — before (17ab2c9)

  Container_Boundary(frontend, "Frontend (React SPA)") {
    Component(app, "App", "React", "Root router, renders DogProfile at /dogs/:id")
    Component(dogProfile, "DogProfile", "React", "Dog detail page: shows dog info, plan assignment, progress")
    Component(progressView, "ProgressView", "React", "Inline weekly progress display")
    Component(dogList, "DogList", "React", "Lists all dogs")
  }

  Container_Boundary(backend, "Backend (Express API)") {
    Component(dogRoutes, "dogRoutes", "Express Router", "CRUD endpoints for dogs")
    Component(planRoutes, "planRoutes", "Express Router", "CRUD endpoints for plans")
    Component(trainingRoutes, "trainingRoutes", "Express Router", "CRUD endpoints for trainings")
  }

  Rel(app, dogProfile, "routes to", "/dogs/:id")
  Rel(dogProfile, progressView, "renders")
  Rel(dogProfile, dogRoutes, "GET /api/dogs/:id, PUT/DELETE /api/dogs/:id/plan")
  Rel(dogProfile, planRoutes, "GET /api/plans, GET /api/plans/:id")
  Rel(dogProfile, trainingRoutes, "GET /api/trainings")
  Rel(dogProfile, dogList, "navigates to", "Link to /")
```

## Evidence
- `App` routes to `DogProfile` — `app/frontend/src/App.tsx` (`<Route path="/dogs/:id" element={<DogProfile />} />`).
- `DogProfile` renders `ProgressView` — `app/frontend/src/DogProfile.tsx` (`import ProgressView`; `<ProgressView dogId={id!} ... />`).
- `DogProfile` calls `dogRoutes` — `fetch(/api/dogs/${id})`, `fetch(/api/dogs/${id}/plan, {method:'PUT'})`, `fetch(/api/dogs/${id}/plan, {method:'DELETE'})`.
- `DogProfile` calls `planRoutes` — `fetch('/api/plans')`, `fetch(/api/plans/${...})`.
- `DogProfile` calls `trainingRoutes` — `fetch('/api/trainings')`.
- `DogProfile` links to dog list — `<Link to="/">` (Back link).
