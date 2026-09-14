Closes {{GITHUB_ISSUE_URL}}

## Summary

Add CSV export of a dog's training progress. A new backend endpoint `GET /api/dogs/:dogId/sessions/export` returns the dog's full session history (completed and skipped sessions) as a `text/csv` download, with columns `date,training,status,score,notes`, training ids resolved to names, RFC-4180 quote-escaping, and a `Content-Disposition` filename of `{dog-name}-progress-{date-range}.csv`. The Progress page (`/progress`) gains an **Export CSV** button once a dog is selected.

## Test Output

```
 ✓ sessions/sessionRoutes.integration.test.ts  (34 tests) 647ms
 ✓ sessions/SessionListingService.test.ts  (7 tests) 6ms
 ✓ trainings/trainingRoutes.integration.test.ts  (15 tests) 359ms
 ✓ dogs/dogRoutes.integration.test.ts  (18 tests) 270ms
 ✓ e2e.test.ts  (11 tests) 374ms
 ✓ plans/planRoutes.integration.test.ts  (12 tests) 308ms
 ✓ sessions/FsSessionRepository.test.ts  (7 tests) 240ms
 ✓ sessions/sessionCsv.test.ts  (14 tests) 4ms
 ✓ dogs/FsDogRepository.test.ts  (8 tests) 160ms
 ✓ trainings/FsTrainingRepository.test.ts  (5 tests) 97ms
 ✓ plans/FsPlanRepository.test.ts  (5 tests) 106ms
 ✓ health/healthRoutes.test.ts  (1 test) 20ms

 Test Files  12 passed (12)
      Tests  137 passed (137)

Frontend: Test Files  17 passed (17) / Tests  98 passed (98)
```

## Lint Output

```
Clean — no warnings or errors (backend `eslint .` and frontend `eslint .` both pass).
```

## Screenshots

artifacts/screenshots/progress-export.png — Progress page with a dog selected, showing the new blue "Export CSV" button next to "Change dog".
