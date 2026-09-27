# Component Diagram (diff)

**Base:** `6d8309b` — beads (Jo Van Eyck, 2026-09-25)
**Head:** `f070a89` — fix: address SonarCloud feedback (jo-clank, 2026-09-25)

```mermaid
C4Component
  title Component Diff — fix: address SonarCloud feedback (f070a89) vs beads (6d8309b)

  Container_Boundary(fe, "Frontend (React)") {
    Component(progressReport, "[~] ProgressReport", "TSX", "Progress screen, gains CSV export action")
    Component(progressCsv, "[+] progressCsv", "TS", "Builds escaped CSV from sessions")
    Component(progressGraph, "ProgressGraph", "TSX", "Score chart")
    Component(dogTile, "DogTile", "TSX", "Dog picker tile")
  }
  Container_Ext(api, "Backend API", "Express", "/api/dogs, /api/trainings, sessions")

  Rel(progressReport, progressCsv, "builds CSV via", "buildProgressCsv()")
  Rel(progressReport, progressGraph, "renders")
  Rel(progressReport, dogTile, "renders")
  Rel(progressReport, api, "fetches", "fetch('/api/...')")

  UpdateElementStyle(progressCsv, $bgColor="#e6ffed", $borderColor="#22863a", $fontColor="#22863a")
  UpdateElementStyle(progressReport, $bgColor="#fff5b1", $borderColor="#b08800", $fontColor="#735c0f")
  UpdateRelStyle(progressReport, progressCsv, $lineColor="#22863a", $textColor="#22863a")
```

## Legend
🟢 added  🔴 removed  🟠 changed  ⚪ unchanged (context)

## Evidence
- 🟢 `progressCsv`: new module `app/frontend/src/progressCsv.ts` (`buildProgressCsv`, `escapeCell` with quote escaping + formula-injection guard).
- 🟢 Edge ProgressReport → progressCsv: `import { buildProgressCsv } from './progressCsv'` in `ProgressReport.tsx`.
- 🟠 `ProgressReport`: adds an export button that builds a CSV Blob and triggers a download (`link.download = progress-<dog>-<training>-<range>.csv`).

## Summary
One frontend module is new: `progressCsv`, which turns the filtered sessions into CSV. `ProgressReport` now calls it and downloads the file in the browser. Nothing was removed. The backend and API calls are unchanged; the export reuses session data that has already been fetched.
