# Component Diagram (after)

**Head:** `aefb009` — feat: add delete dog action to detail page (Jo Van Eyck, 2026-09-14)

```mermaid
C4Component
  title Component Diagram (after) — DogProfile detail page — aefb009

  Container_Boundary(frontend, "Frontend (React)") {
    Component(dogProfile, "DogProfile", "TSX", "Dog detail page: shows dog, assigns/unassigns plan, deletes dog, renders progress")
    Component(progressView, "ProgressView", "TSX", "Renders training progress")
  }
  Container_Boundary(backend, "Backend API") {
    Component(dogsApi, "Dogs API", "Express", "/api/dogs endpoints")
    Component(plansApi, "Plans API", "Express", "/api/plans endpoints")
  }

  Rel(dogProfile, progressView, "renders")
  Rel(dogProfile, dogsApi, "reads/updates/deletes", "GET /api/dogs/:id, DELETE /api/dogs/:id")
  Rel(dogProfile, plansApi, "reads", "GET /api/plans")
```

## Evidence
- `DogProfile` — `app/frontend/src/DogProfile.tsx`; adds `handleDelete` calling `DELETE /api/dogs/:id` and `navigate('/')` on success.
- Edge `DogProfile → Dogs API` now also covers the delete call.

## Summary
After the change, `DogProfile` gains a delete-dog capability that calls the existing `DELETE /api/dogs/:id` endpoint and navigates to the dog list on success.
