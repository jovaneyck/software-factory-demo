Closes https://github.com/jovaneyck/software-factory-demo/issues/28

## Summary

Adds a CSV export for a dog's session results. A new backend endpoint `GET /api/dogs/:dogId/sessions/export?from=<date>&to=<date>[&trainingId=<uuid>]` returns a downloadable `text/csv` file. The file carries the dog's name and the exported date range as a metadata preamble, followed by the agreed table `Date,Training,Status,Score,Notes` for completed/skipped sessions only. On the Progress page, an **Export CSV** link appears once a dog and training are selected and honors the active All/Year/Month/Week time filter.

## Test Output

```
# app/backend  ->  npm test
 Test Files  12 passed (12)
      Tests  132 passed (132)

# app/frontend ->  npm test
 Test Files  17 passed (17)
      Tests  99 passed (99)
```

## Lint Output

```
# app/backend  ->  npm run lint   (eslint .)   -> Clean — no warnings or errors.
# app/frontend ->  npm run lint   (eslint .)   -> Clean — no warnings or errors.
```

## Screenshots

artifacts/screenshots/progress-export-csv.png — Progress page (`/progress`) with Django + "Leash training" selected: the new "Export CSV" link sits beside the All/Year/Month/Week range filters, above the score graph.