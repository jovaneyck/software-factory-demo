Closes #15

## Summary

Add a "Delete Dog" action to the dog detail page (DogProfile). A dedicated red "Danger Zone" section at the bottom of the page — visible in both the plan-assigned and no-plan states — lets the user permanently delete a dog. Deletion is guarded by a `window.confirm` prompt, calls the existing `DELETE /api/dogs/:id` endpoint (which also removes the dog's uploaded picture), and navigates back to the dog list on success.

## Test Output

```
 ✓ src/DogProfile.test.tsx (9 tests) 657ms

 Test Files  1 passed (1)
      Tests  9 passed (9)
```

Full suite: 16 test files / 95 tests passed. (One run showed a vitest worker startup timeout — an environment/resource flake, not a test failure; all tests pass, and the DogProfile suite passes deterministically on re-run.)

## Lint Output

```
Clean — no warnings or errors.
```

## Screenshots

screenshots/proof.png — DogProfile page showing the new "Danger Zone" section with the red "Delete Dog" button at the bottom of the page.
