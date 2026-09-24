Closes https://github.com/jovaneyck/software-factory-demo/issues/30

## Summary

Add a CSV download to the dog progress graph, honoring its selected date range and exporting completed/skipped training sessions with dog, training, score, and notes.

## Test Output

```
 ✓ src/PlanEdit.test.tsx (2 tests) 930ms
     ✓ submits updated plan  707ms
 ✓ src/DogForm.test.tsx (2 tests) 1091ms
     ✓ renders the form  698ms
     ✓ submits the form with name and picture  390ms
 ✓ src/App.test.tsx (4 tests) 475ms
 ✓ src/PlanDetail.test.tsx (2 tests) 951ms
     ✓ displays plan name and navigation links  747ms
 ✓ src/TrainingPlanSchedule.test.tsx (4 tests) 475ms
     ✓ renders training names as links to /trainings/:id  325ms
 ✓ src/DogList.test.tsx (6 tests) 179ms
 ✓ src/PlanList.test.tsx (4 tests) 208ms
 ✓ src/ProgressGraph.test.tsx (7 tests) 405ms
 ✓ src/TrainingList.test.tsx (4 tests) 142ms

 Test Files  17 passed (17)
      Tests  98 passed (98)
   Start at  09:13:08
   Duration  75.66s (transform 4.49s, setup 2.64s, import 22.40s, tests 21.17s, environment 23.48s)
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

artifacts/screenshots/dog-training-results-export.png — Dog progress graph showing the selected training, date filters, and Export to CSV button.
