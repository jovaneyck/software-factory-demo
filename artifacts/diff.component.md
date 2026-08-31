# Component Diagram (diff)

**Base:** `17ab2c9` — le format (Jo Van Eyck, 2026-08-27)
**Head:** `cad32c7` — docs: update architecture artifact head references to final PR commit (Jo Van Eyck, 2026-08-31)

```mermaid
C4Component
  title Component Diff — feat(dogs): add delete functionality (cad32c7) vs le format (17ab2c9)

  Container_Boundary(frontend, "Frontend (React SPA)") {
    Component(app, "App", "React", "Root router, renders DogProfile at /dogs/:id")
    Component(dogProfile, "[~] DogProfile", "React", "Dog detail page: added delete with confirmation + navigation")
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
  Rel(dogProfile, dogRoutes, "GET, PUT/DELETE plan, DELETE dog", "handleDelete()")
  Rel(dogProfile, planRoutes, "GET /api/plans, GET /api/plans/:id")
  Rel(dogProfile, trainingRoutes, "GET /api/trainings")
  Rel(dogProfile, dogList, "navigates to", "useNavigate('/') + Link")

  %% changed (amber)
  UpdateElementStyle(dogProfile, $bgColor="#fff5b1", $borderColor="#b08800", $fontColor="#735c0f")
  UpdateRelStyle(dogProfile, dogRoutes, $lineColor="#b08800", $textColor="#735c0f")
  UpdateRelStyle(dogProfile, dogList, $lineColor="#b08800", $textColor="#735c0f")
```

## Legend
🟢 added  🔴 removed  🟠 changed  ⚪ unchanged (context)

## Evidence
- 🟠 `DogProfile` — gained `useNavigate` import and `handleDelete` function in `app/frontend/src/DogProfile.tsx`. New Delete Dog button calls `window.confirm()`, then `fetch(/api/dogs/${id}, {method:'DELETE'})` wrapped in `try/catch`, then `navigate('/')` on success. Both non-OK responses and rejected promises show a failure alert.
- 🟠 `DogProfile → dogRoutes` — relationship expanded: previously called `GET /api/dogs/:id`, `PUT /api/dogs/:id/plan`, `DELETE /api/dogs/:id/plan`. Now additionally calls `DELETE /api/dogs/:id` (the dog-level delete endpoint).
- 🟠 `DogProfile → DogList` — navigation mechanism expanded: previously only `<Link to="/">` (Back link). Now also `navigate('/')` via `useNavigate` after successful delete, providing programmatic navigation.

## Summary
No components were added or removed. `DogProfile` was changed to use an existing backend endpoint (`DELETE /api/dogs/:id`) that was already wired in `dogRoutes`. The component gained a new outbound call to the dog delete endpoint and programmatic navigation to the dog list after deletion. All other components and relationships remain unchanged. This is a purely additive frontend change — no backend modifications were needed.
