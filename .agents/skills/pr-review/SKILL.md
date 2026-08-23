---
name: pr-review
description: 'Review changes in a commit, PR. Do a code review. Review pending changes. Review my code'
---

# Rules to validate

## Completeness

* [completeness-check] if provided with a spec, a plan, or a list of acceptance criteria, check that the changes cover all of them. If not, report the missing items as **drift** between the spec and the implementation. For acceptance criteria specifically, verify that automated tests cover the concrete scenario.

## Semver

* [semver-update-required] If we perform changes that impact public contracts/behaviors, our relevant PackageVersion.props file should be updated to reflect that.
* [semver-violation] Highlight mismatches between the semver bump and the actual changes.

## Consistency

* [consistency-type-file] Every type should be in a file with the same name. Nested types (child-parent relationships) can be in the same file.
* [naming-types] New types should follow the same naming conventions of existing types.

Only report actual violations that require action. Do NOT report categories where everything is fine.
Give your feedback as a bullet-list listing the category, a 1-sentence description and a link to the code.
End with a single summary line listing all checked categories (e.g. "Checked: semver, consistency-type-file, naming-types").

## Examples

* [naming-types] Mensura.Contracts.ConfigResponse should be named Mensura.Contracts.Config to be in line with the other types in the contract namespace. [INT.CIAM.Contracts.Config](./src/INT.CIAM.Contracts/Config.cs)
* [semver-violation] Breaking API change by removing the "Issuer" property in Mensura.Contracts.ConfigResponse, but the 2.3.0 version indicates a minor version increase. [INT.CIAM.Contracts.Config](./src/INT.CIAM.Contracts/Config.cs)
* [completeness-check] spec.md contains the acceptance criterium "splitting an empty basket is a NO-OP", but there is no test for this scenario in the code. [spec.md](./specs/202607601_split_basket/spec.md)