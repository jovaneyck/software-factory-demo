Closes https://github.com/jovaneyck/software-factory-demo/issues/37

## Summary

Add per-dog CSV export of logged training sessions (completed/skipped) via a new `GET /api/dogs/:dogId/sessions/export.csv` endpoint and an "Export CSV" button on the dog profile's Sessions section.

## Design (agreed via grill-me)

- **Scope:** one dog at a time, all-time (`2000-01-01` → `2099-12-31`), matching the Progress report's window.
- **Statuses:** logged sessions only (`completed`/`skipped`); computed `planned` sessions are excluded.
- **Entry point:** an "Export CSV" link with a download icon in the `Sessions` `Section` action slot on `DogProfile` (`/dogs/:id`).
- **Backend generation:** reuse `SessionListingService` to merge/select sessions, resolve training names via `TrainingRepository`, and serialize with a pure `sessionsToCsv` helper.
- **Format:** header `Date,Training,Status,Score,Notes`, rows sorted by date ascending; UTF-8 BOM + CRLF line endings; RFC 4180 quoting for fields containing commas, quotes, or newlines.
- **Download:** `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="<dog-slug>-sessions.csv"`.
- **Empty result:** returns a header-only CSV with `200` (not `204`/`404`).

## Lint Output

```
Clean — no warnings or errors.
```

## Screenshots

artifacts/screenshots/dog-profile-csv-export.png — Django's dog profile with the new "Export CSV" button in the Sessions section.
