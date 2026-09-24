# Component Diagram (Diff)

**Base:** `37f548c` - cleanup (Jo Van Eyck, 2026-09-19)
**Head:** `bcb4ed7` - fix(sessions): protect non-string CSV cells from formulas (#24) (jo-clank, 2026-09-22)

```mermaid
C4Component
  title CSV export - bcb4ed7 (jo-clank, 2026-09-22) vs cleanup 37f548c (Jo Van Eyck, 2026-09-19)
  Container_Boundary(ui, "React frontend") {
    Component(report, "[~] ProgressReport", "React", "Graphs and full-history download")
    Component(graph, "ProgressGraph", "D3", "Score graph")
    Component(tile, "DogTile", "React", "Dog selection")
    Component(icon, "[+] Download", "lucide-react", "Download action icon")
  }
  Container_Boundary(api, "Express backend") {
    Component(app, "[~] createApp", "TypeScript", "Dependency wiring")
    Component(routes, "[~] sessionRoutes", "Express", "JSON and CSV endpoints")
    Component(listing, "SessionListingService", "TypeScript", "Recorded and generated planned entries")
    Component(dogs, "FsDogRepository", "JSON files", "Dog lookup")
    Component(sessions, "FsSessionRepository", "JSON files", "Recorded sessions")
    Component(trainings, "[~] FsTrainingRepository", "JSON files", "New consumer; implementation unchanged")
    Component(csv, "[+] sessionCsv", "TypeScript", "Filters, sorts and normalizes recorded cells")
    Component(papa, "[+] Papa Parse", "Library", "CSV quoting and formula protection")
  }
  Rel(report, graph, "renders")
  Rel(report, tile, "renders")
  Rel(report, icon, "[+] renders")
  Rel(report, routes, "[~] JSON plus CSV download", "HTTP")
  Rel(app, routes, "[~] also injects trainings")
  Rel(app, dogs, "constructs")
  Rel(app, sessions, "constructs")
  Rel(app, trainings, "constructs")
  Rel(app, listing, "constructs")
  Rel(routes, dogs, "validates dog", "getById")
  Rel(routes, sessions, "[~] also reads full history", "getByDogIdInRange")
  Rel(routes, listing, "lists calendar sessions", "list")
  Rel(listing, dogs, "reads dog")
  Rel(listing, sessions, "reads date range")
  Rel(routes, trainings, "[+] reads names", "getAll")
  Rel(routes, csv, "[+] serializes recorded history", "sessionCsv")
  Rel(csv, papa, "[+] escapes normalized cells", "unparse")
  UpdateElementStyle(icon, $bgColor="#e6ffed", $borderColor="#22863a", $fontColor="#22863a")
  UpdateElementStyle(csv, $bgColor="#e6ffed", $borderColor="#22863a", $fontColor="#22863a")
  UpdateElementStyle(papa, $bgColor="#e6ffed", $borderColor="#22863a", $fontColor="#22863a")
  UpdateElementStyle(report, $bgColor="#fff5b1", $borderColor="#b08800", $fontColor="#735c0f")
  UpdateElementStyle(app, $bgColor="#fff5b1", $borderColor="#b08800", $fontColor="#735c0f")
  UpdateElementStyle(routes, $bgColor="#fff5b1", $borderColor="#b08800", $fontColor="#735c0f")
  UpdateElementStyle(trainings, $bgColor="#fff5b1", $borderColor="#b08800", $fontColor="#735c0f")
  UpdateRelStyle(report, icon, $lineColor="#22863a", $textColor="#22863a")
  UpdateRelStyle(routes, trainings, $lineColor="#22863a", $textColor="#22863a")
  UpdateRelStyle(routes, csv, $lineColor="#22863a", $textColor="#22863a")
  UpdateRelStyle(csv, papa, $lineColor="#22863a", $textColor="#22863a")
  UpdateRelStyle(report, routes, $lineColor="#b08800", $textColor="#735c0f")
  UpdateRelStyle(app, routes, $lineColor="#b08800", $textColor="#735c0f")
  UpdateRelStyle(routes, sessions, $lineColor="#b08800", $textColor="#735c0f")
```

## Legend

Green `[+]`: added. Amber `[~]`: changed behavior or relationship. Default: unchanged context. No removals. The training repository is amber only because it gains a consumer; its implementation is unchanged.

## Evidence

- [ProgressReport.exportSessions](https://github.com/jovaneyck/software-factory-demo/blob/bcb4ed7/app/frontend/src/ProgressReport.tsx): new CSV fetch/Blob download and `Download` import; graph/tile rendering retained.
- [createApp](https://github.com/jovaneyck/software-factory-demo/blob/bcb4ed7/app/backend/createApp.ts): adds `trainingRepo` to the session-route factory call.
- [sessionRoutes](https://github.com/jovaneyck/software-factory-demo/blob/bcb4ed7/app/backend/sessions/sessionRoutes.ts): new export handler reads full persisted history and current training names, then invokes `sessionCsv`; JSON listing still uses `SessionListingService`.
- [sessionCsv](https://github.com/jovaneyck/software-factory-demo/blob/bcb4ed7/app/backend/sessions/sessionCsv.ts): new module normalizes cells before `Papa.unparse` applies CSV and formula escaping.
- [Before](https://github.com/jovaneyck/software-factory-demo/blob/feat/24/artifacts/before.component.md) and [after](https://github.com/jovaneyck/software-factory-demo/blob/feat/24/artifacts/after.component.md) provide the single-state diagrams.

## Summary

Added a CSV serializer and library/icon dependencies. Changed report-to-API behavior and route dependency wiring to support full recorded-history downloads. Removed nothing; no database, persistence schema, service deployment, or existing JSON API changes. The graph and calendar listing remain unchanged. This export-focused subgraph omits unrelated route wiring and unchanged plan dependencies.