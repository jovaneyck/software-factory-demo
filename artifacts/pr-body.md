Closes software-factory-demo-1789396054439-1-2a07a94f

## Summary

Adds CSV export of a dog's recorded training session history. A new backend endpoint
`GET /api/dogs/:dogId/sessions.csv` (optional `from`/`to` query params, all-time by default)
returns an RFC 4180 `text/csv` attachment built by a new `SessionCsvExporter` service, and the
dog profile page (`/dogs/:id`) gains an **Export CSV** link that downloads it.

## Details

- **Backend**: `SessionCsvExporter` looks up the dog, joins training IDs to names, filters to
  recorded sessions (`completed`/`skipped`), and emits `Date,Training,Status,Score,Notes`.
  Rows sort by date then training name; fields containing commas/quotes/newlines are quoted and
  escaped; cells starting with a formula trigger (`=`, `+`, `-`, `@`, tab, CR) are prefixed with
  a single quote to prevent CSV formula injection (CWE-1236); a UTF-8 BOM plus CRLF line endings
  keep Excel happy. Filename is slugified from the dog name (e.g. `django-sessions.csv`).
- **Route**: added to `sessionRoutes` and wired in `createApp`. Returns `404` for unknown dogs
  and `400` for invalid UUIDs (existing `validateUuid` middleware).
- **Frontend**: `DogProfile` renders the export link next to the dog name, always available
  regardless of whether a plan is assigned.

## Test Output

```
> dogtrainr-backend@1.0.0 test
> vitest run

 ✓ sessions/sessionRoutes.integration.test.ts  (37 tests) 430ms
 ✓ sessions/SessionCsvExporter.test.ts  (10 tests) 10ms
 Test Files  12 passed (12)
      Tests  136 passed (136)
   Duration  ~10s

> frontend@0.0.0 test
> vitest run

 Test Files  17 passed (17)
      Tests  98 passed (98)
   Duration  36.36s
```

## Lint Output

```
> eslint .   (backend)
> eslint .   (frontend)
```

Clean — no warnings or errors.

## Screenshots

artifacts/screenshots/dog-csv-export.png — Django's dog profile page showing the new "Export CSV" link next to the dog name.
