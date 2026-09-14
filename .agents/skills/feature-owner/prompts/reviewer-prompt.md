Review the PR at {{PR_URL}}.

Check out the branch, read the diff, and submit your review using `gh pr review --comment` (NOT `--approve` or `--request-changes`, since the PR author token is the same).

You have the `pr-review` skill loaded (`.agents/skills/pr-review/SKILL.md`). Read it and use its "Rules to validate" as an **exhaustive checklist**: work through every rule/category it defines, one by one, and evaluate the diff against each. Follow its reporting format exactly — report only actual violations that require action (do NOT report categories where everything is fine), give feedback as a bullet list of `[category] one-sentence description + link to code`, and end with a single summary line listing all categories you checked (e.g. "Checked: semver, consistency-type-file, naming-types").

In addition to the skill's checklist, also confirm:
- Correctness
- Test coverage
- Adherence to existing codebase patterns
- **Screenshot proof completeness (frontend changes):** if the change affects the UI, verify the PR body includes a screenshot for **every** impacted screen, not just one. If the change adds navigation to another screen (a new button/link opening a new or existing page, a new route, a modal, a redirect), both the originating screen **and** the destination screen must have screenshots. Flag any impacted screen that is missing visual proof.
