# Component Diagram (before)

**Base:** `cde8b68` — start factory cleanup (Jo Van Eyck, 2026-09-14)

```mermaid
C4Component
  title Component Diagram (before) — DogProfile detail page — cde8b68

  Container_Boundary(frontend, "Frontend (React)") {
    Component(dogProfile, "DogProfile", "TSX", "Dog detail page: shows dog, assigns/unassigns plan, renders progress")
    Component(progressView, "ProgressView", "TSX", "Renders training progress")
  }
  Container_Boundary(backend, "Backend API") {
    Component(dogsApi, "Dogs API", "Express", "/api/dogs endpoints")
    Component(plansApi, "Plans API", "Express", "/api/plans endpoints")
  }

  Rel(dogProfile, progressView, "renders")
  Rel(dogProfile, dogsApi, "reads/updates plan", "GET /api/dogs/:id, PUT/DELETE /api/dogs/:id/plan")
  Rel(dogProfile, plansApi, "reads", "GET /api/plans")
```

## Evidence
- `DogProfile` — `app/frontend/src/DogProfile.tsx`; fetches `/api/dogs/:id`, assigns/unassigns via `/api/dogs/:id/plan`.
- `ProgressView` — imported and rendered in `DogProfile.tsx`.
- Edges to `Dogs API` / `Plans API` — `fetch()` calls in `DogProfile.tsx`.

## Summary
Baseline structure of the dog detail page before the delete feature: `DogProfile` reads a dog, manages plan assignment, and renders `ProgressView`.
