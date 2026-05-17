# releases

## Scope
- Covers release metadata and validation artifacts under `releases/`.

## Architecture Design
- Each release tag has one `vYYYY.MM.DD` directory, with a `.N` suffix only for same-day re-cuts.
- `manifest.json` records the exact published artifact versions.
- `validation.md` and `findings/*.jsonl` are generated post-release evidence.

## Required
- Must keep one manifest per release directory.
- Must keep binary and container versions equal to the CalVer tag without the leading `v`.
- Must keep npm and PyPI versions equal to the package versions actually published.
- Must generate validation output through `scripts/postRelease/aggregateReport.ts`.

## Forbidden
- Must not edit a published manifest in place after release.
- Must not hand-edit validation reports or findings JSONL.
- Must not store secrets, signing keys, unpublished artifacts, or narrative release notes here.

## Validation
- Validate release entries by comparing the manifest to published registries and post-release findings.

