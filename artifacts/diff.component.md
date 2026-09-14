# Component Diagram (diff)

**Base:** `cde8b68` — start factory cleanup (Jo Van Eyck, 2026-09-14)
**Head:** `aefb009` — feat: add delete dog action to detail page (Jo Van Eyck, 2026-09-14)

```mermaid
C4Component
  title Component Diff — feat: add delete dog action (aefb009) vs start factory cleanup (cde8b68)

  Container_Boundary(frontend, "Frontend (React)") {
    Component(dogProfile, "[~] DogProfile", "TSX", "Dog detail page: now also deletes a dog")
    Component(progressView, "ProgressView", "TSX", "Renders training progress")
  }
  Container_Boundary(backend, "Backend API") {
    Component(dogsApi, "Dogs API", "Express", "/api/dogs endpoints (DELETE :id already existed)")
    Component(plansApi, "Plans API", "Express", "/api/plans endpoints")
  }

  Rel(dogProfile, progressView, "renders")
  Rel(dogProfile, dogsApi, "reads/updates plan")
  Rel(dogProfile, dogsApi, "deletes via", "DELETE /api/dogs/:id")
  Rel(dogProfile, plansApi, "reads")

  UpdateElementStyle(dogProfile, $bgColor="#fff5b1", $borderColor="#b08800", $fontColor="#735c0f")
  UpdateRelStyle(dogProfile, dogsApi, $lineColor="#22863a", $textColor="#22863a")
```

## Legend
🟢 added  🔴 removed  🟠 changed  ⚪ unchanged (context)

## Evidence
- 🟠 `DogProfile` — `app/frontend/src/DogProfile.tsx`: adds `handleDelete` (`window.confirm` → `fetch(DELETE /api/dogs/:id)` → `navigate('/')`) and a "Danger Zone" delete button; imports `useNavigate`.
- 🟢 `DogProfile → Dogs API` delete edge — new `fetch('/api/dogs/:id', { method: 'DELETE' })` usage. The backend endpoint itself already existed, so no backend node changed.

## Summary
No new components or removed components. The only structural change is that `DogProfile` gained an outbound relationship to the already-existing `Dogs API` `DELETE /api/dogs/:id` endpoint (plus a client-side navigation to the dog list). All backend structure is unchanged.
