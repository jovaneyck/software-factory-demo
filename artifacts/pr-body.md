Closes https://github.com/jovaneyck/software-factory-demo/issues/26

## Summary

Adds a "Surprise me" action on the home page and dog detail page that pops up the training the dog has not performed for the longest time and lets the owner register it ad hoc through the existing session registration sheet.

## Test Output

```
> dogtrainr-backend@1.0.0 test
> vitest run
 ✓ sessions/sessionRoutes.integration.test.ts  (29 tests)
 ✓ sessions/SessionListingService.test.ts  (7 tests)
 ✓ trainings/trainingRoutes.integration.test.ts  (15 tests)
 ✓ dogs/dogRoutes.integration.test.ts  (18 tests)
 ✓ e2e.test.ts  (11 tests)
 ✓ plans/planRoutes.integration.test.ts  (12 tests)
 ✓ trainings/SurpriseTrainingService.test.ts  (8 tests)
 ✓ sessions/FsSessionRepository.test.ts  (7 tests)
 ✓ trainings/surpriseTrainingRoutes.integration.test.ts  (4 tests)
 ✓ dogs/FsDogRepository.test.ts  (8 tests)
 ✓ trainings/FsTrainingRepository.test.ts  (5 tests)
 ✓ plans/FsPlanRepository.test.ts  (5 tests)
 ✓ health/healthRoutes.test.ts  (1 test)
 Test Files  13 passed (13)
      Tests  130 passed (130)

> frontend@0.0.0 test
> vitest run
 Test Files  18 passed (18)
      Tests  103 passed (103)
   Duration  94.41s
```

## Lint Output

```
Clean — no warnings or errors.
```

## Screenshots

<!-- Each screenshot must be a commit-pinned Markdown image so GitHub renders it:
     ![caption](https://github.com/<owner>/<repo>/blob/<SHA>/artifacts/screenshots/<file>.png?raw=true)
     A plain relative path will NOT render and will 404. -->
artifacts/screenshots/surprise-home.png — Home page: each dog has a "Surprise me" action
artifacts/screenshots/surprise-dog-detail.png — Dog detail page: the "Surprise me" button beside the dog name
artifacts/screenshots/surprise-modal.png — Surprise training ("Recall", the longest-unperformed) popped up in the reused registration sheet
