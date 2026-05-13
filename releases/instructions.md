# Releases

## Scope
- Only release metadata that pins every Caracal artifact to a single GitHub release tag, plus the post-release validation report for that tag.

## Required
- One directory per release tag, named exactly `vYYYY.MM.DD` (with `.N` suffix on same-day re-cuts).
- Each directory must contain exactly one `manifest.json` and exactly one `validation.md`.
- `manifest.json` must list `release`, `publishedAt`, `binaries` (cli, tui), `containers`, `pypi`, and `npm` with every published artifact mapped to its version string.
- Container versions and binary versions must equal the CalVer release tag without the leading `v`.
- PyPI and npm versions must equal the semver string actually published to each registry.
- `validation.md` must be produced only by `caracal/scripts/postRelease/aggregateReport.ts`.
- Every release cut must add `manifest.json` in the same commit as the changeset version bump; `validation.md` lands later via the post-release workflow PR.

## Forbidden
- Must not edit a published `manifest.json` after the release lands; cut a new tag instead.
- Must not hand-edit `validation.md`; rerun the workflow.
- Must not omit artifacts that were published under the release tag.
- Must not store secrets, signing keys, or narrative release notes here.
