# Component Diagram (After)

**Base:** `37f548c` - cleanup (Jo Van Eyck, 2026-09-19)
**Head:** `bcb4ed7` - fix(sessions): protect non-string CSV cells from formulas (#24) (jo-clank, 2026-09-22)

```mermaid
C4Component
  title After - protect non-string CSV cells (bcb4ed7, jo-clank, 2026-09-22)
  Container_Boundary(ui, "React frontend") {
    Component(report, "ProgressReport", "React", "Graphs and full-history download")
    Component(graph, "ProgressGraph", "D3", "Score graph")
    Component(tile, "DogTile", "React", "Dog selection")
    Component(icon, "Download", "lucide-react", "Download action icon")
  }
  Container_Boundary(api, "Express backend") {
    Component(app, "createApp", "TypeScript", "Dependency wiring")
    Component(routes, "sessionRoutes", "Express", "JSON and CSV endpoints")
    Component(listing, "SessionListingService", "TypeScript", "Recorded and generated planned entries")
    Component(dogs, "FsDogRepository", "JSON files", "Dog lookup")
    Component(sessions, "FsSessionRepository", "JSON files", "Recorded sessions")
    Component(trainings, "FsTrainingRepository", "JSON files", "Current training names")
    Component(csv, "sessionCsv", "TypeScript", "Filters, sorts and normalizes recorded cells")
    Component(papa, "Papa Parse", "Library", "CSV quoting and formula protection")
  }
  Rel(report, graph, "renders")
  Rel(report, tile, "renders")
  Rel(report, icon, "renders")
  Rel(report, routes, "reads JSON and downloads CSV", "HTTP")
  Rel(app, routes, "registers with dogs, sessions, listing, trainings")
  Rel(app, dogs, "constructs")
  Rel(app, sessions, "constructs")
  Rel(app, trainings, "constructs")
  Rel(app, listing, "constructs")
  Rel(routes, dogs, "validates dog", "getById")
  Rel(routes, sessions, "reads records including full history", "getByDogIdInRange")
  Rel(routes, listing, "lists calendar sessions", "list")
  Rel(listing, dogs, "reads dog")
  Rel(listing, sessions, "reads date range")
  Rel(routes, trainings, "reads names", "getAll")
  Rel(routes, csv, "serializes recorded history", "sessionCsv")
  Rel(csv, papa, "escapes normalized cells", "unparse")
```

## Evidence

- [ProgressReport.exportSessions](https://github.com/jovaneyck/software-factory-demo/blob/bcb4ed7/app/frontend/src/ProgressReport.tsx): fetches `/api/dogs/:id/sessions/export.csv`, downloads a Blob, reports failures, and renders the Lucide `Download` icon; graph and tile dependencies are retained.
- [createApp](https://github.com/jovaneyck/software-factory-demo/blob/bcb4ed7/app/backend/createApp.ts): injects `trainingRepo` into `sessionRoutes` alongside its existing dependencies.
- [sessionRoutes](https://github.com/jovaneyck/software-factory-demo/blob/bcb4ed7/app/backend/sessions/sessionRoutes.ts): calls `dogs.getById`, `sessions.getByDogIdInRange`, `trainings.getAll`, and `sessionCsv` for the CSV attachment. The JSON listing path still calls `service.list`.
- [sessionCsv](https://github.com/jovaneyck/software-factory-demo/blob/bcb4ed7/app/backend/sessions/sessionCsv.ts): filters recorded statuses, sorts dates/IDs, resolves names, normalizes cells with `String`, and calls `Papa.unparse` with formula protection.
- [FsTrainingRepository.getAll](https://github.com/jovaneyck/software-factory-demo/blob/bcb4ed7/app/backend/trainings/FsTrainingRepository.ts): existing implementation supplies current names; no storage changes.

## Summary

The serializer, Papa Parse dependency, and download icon are new. The report gains a CSV HTTP operation; session routes gain training-name lookup and serialization; the composition root injects that repository. Nothing is removed. Existing JSON listing behavior, graph rendering, repository implementations, and persisted schemas remain unchanged. Unrelated routes and unchanged plan dependencies are omitted.