Closes #33

## Summary

Add a dog-specific CSV export for all completed and skipped training sessions, with a new backend download endpoint and an Export CSV button on the selected-dog progress report.

## Test Output

```
 ✓ src/DogProfile.test.tsx (7 tests) 503ms
 ✓ src/App.test.tsx (4 tests) 443ms
 ✓ src/TrainingPlanSchedule.test.tsx (4 tests) 317ms
 ✓ src/TrainingDetail.test.tsx (5 tests) 324ms
 ✓ src/PlanForm.test.tsx (2 tests) 377ms
 ✓ src/PlanEdit.test.tsx (2 tests) 388ms
     ✓ submits updated plan  324ms
 ✓ src/DogForm.test.tsx (2 tests) 342ms
 ✓ src/DogTile.test.tsx (6 tests) 263ms
 ✓ src/PlanDetail.test.tsx (2 tests) 293ms
 ✓ src/ProgressGraph.test.tsx (7 tests) 103ms
 ✓ src/DogList.test.tsx (6 tests) 136ms
 ✓ src/PlanList.test.tsx (4 tests) 117ms
 ✓ src/TrainingList.test.tsx (4 tests) 75ms

 Test Files  17 passed (17)
      Tests  99 passed (99)
   Start at  05:34:10
   Duration  32.95s (transform 1.35s, setup 1.00s, import 8.55s, tests 10.47s, environment 10.20s)
```

## Lint Output

```
> dogtrainr@1.0.0 lint
> npm run lint -w backend && npm run lint -w frontend

> dogtrainr-backend@1.0.0 lint
> eslint .

> frontend@0.0.0 lint
> eslint .
```

## Screenshots

artifacts/screenshots/progress-export.png — Progress report with a selected dog and the Export CSV button visible.
