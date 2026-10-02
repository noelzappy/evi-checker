# Release Evidence Checker

A local web application that reads a JSON release report and determines whether a software release is READY or BLOCKED. It validates the data contract, applies readiness rules to every check including optional ones, and displays specific reasons for any blocking conditions. This is a completeness-checking prototype, not production deployment software.

Written in TypeScript (strict mode). Vite compiles it for the browser and Vitest runs the tests. There are no runtime dependencies.

## Launch

Requires Node.js 18 or newer (developed on Node 22).

```
npm install
npm run dev
```
Then open http://localhost:8000 (if that port is busy, Vite prints the one it picked). `npm start` is an alias for `npm run dev`.

**Production build** (optional): `npm run build` writes a static site to `dist/`, and `npm run preview` serves it on the same port.

**Note**: Opening `index.html` directly via `file://` will not work. The browser cannot run TypeScript, so the Vite dev server (or the built `dist/` folder) is required.

## Run the tests

```
npm install
npm test
```

Other useful commands:
- `npm run typecheck` runs the TypeScript compiler in strict mode with no output.
- `npm run check` runs the typecheck and then the tests.
- `npm run test:watch` re-runs tests on file changes.

## How to use

1. Paste JSON into the text area or click "Choose file" to upload a release report.
2. Click the "Load sample" button to use the provided `sample-release.json`. For other cases, pick a file from the `examples/` folder (see below).
3. Click "Check release" to validate and evaluate readiness.
4. A banner shows READY (green) or BLOCKED (red).
5. Blockers list specific reasons preventing readiness.
6. Warnings show optional checks that failed or were not run.
7. A table displays every check with its id, name, required flag, status, and evidence reference.
8. Load another report at any time and re-check without editing code.

## Example reports for manual testing

The `examples/` folder holds twelve reports, numbered in demo order. Each file name says what the checker should report. Use the file picker or paste the contents into the text area.

| File | Expected result | Why |
|------|-----------------|-----|
| `01-ready-all-required-passed.json` | READY | Four required checks, all passed with evidence |
| `02-ready-with-optional-warnings.json` | READY, 2 warnings | Optional perf check not run, optional a11y check failed |
| `03-blocked-required-failed.json` | BLOCKED, 3 blockers | Contract test failed; load test not run and has no evidence |
| `04-blocked-missing-evidence.json` | BLOCKED, 2 blockers | Whitespace-only evidence on one check, no evidence key on another |
| `05-blocked-only-optional-checks.json` | BLOCKED | No required checks exist |
| `06-blocked-empty-checks.json` | BLOCKED | Empty checks array |
| `07-invalid-duplicate-id.json` | BLOCKED (invalid data) | Two checks share id `unit` |
| `08-invalid-wrong-types.json` | BLOCKED (invalid data), 4 messages | `required` is a string, status is `Passed`, blank name, numeric evidence |
| `09-invalid-optional-check-bad-status.json` | BLOCKED (invalid data) | Optional check has status `skipped`; invalid data blocks even on optional checks |
| `10-invalid-missing-release.json` | BLOCKED (invalid data) | No `release` field |
| `11-invalid-root-is-array.json` | BLOCKED (invalid data) | Root is an array, not an object |
| `12-malformed-json.json` | BLOCKED (malformed JSON) | File is cut off mid-array |

`test/examples.test.ts` asserts the verdict, kind, and blocker and warning counts for every one of these files, so the table above cannot drift from the code.

## Readiness logic

The checker performs three sequential steps:

1. **Parse JSON**: Text input → JavaScript object. Parsing errors are reported clearly.
2. **Validate the data contract**: Check root structure, release string, checks array, and every check's fields including optional ones. All errors are collected, not just the first.
3. **Apply readiness rules** (only on valid data): Determine blockers and warnings based on check status and evidence.

**Readiness rules**:
- At least one required check must exist. Empty checks array or only optional checks → BLOCKED.
- Every required check must have status `passed`.
- Every required check must have nonblank evidence (whitespace-only is treated as missing).
- Optional failed/not_run checks produce warnings but do not block.
- Invalid data (malformed, wrong types, duplicate ids, unknown status) → always BLOCKED.

**Data contract**:
- Root: JSON object with `release` (nonblank string) and `checks` (array).
- Each check has `id` (nonblank string, unique), `name` (nonblank string), `required` (boolean), `status` (`passed`, `failed`, or `not_run`), and optionally `evidence` (string).
- Unknown extra fields are ignored.

Evidence is a supplied reference string only. The app never fetches it or verifies its contents.

## Project layout

```
.
├── index.html               Entry point; defines UI layout
├── style.css                Styles for the application
├── package.json             Dependencies and npm scripts
├── tsconfig.json            Strict TypeScript settings
├── vite.config.ts           Dev server, build and Vitest settings
├── sample-release.json      Example release report
├── CONTRACT.md              Precise data contract and validation rules
├── docs-Candidate_Brief.txt Original requirements and scope
├── README.md                This file
├── examples/                Twelve reports for manual testing, named by expected result
├── src/
│   ├── checker.ts           Pure logic and types: parse, validate, evaluate
│   └── app.ts               UI layer; DOM binding and user interaction
└── test/
    ├── checker.test.ts      Vitest test suite with reproducible cases
    ├── examples.test.ts     Pins the expected verdict of every file in examples/
    └── fixtures/            JSON fixtures for test scenarios
```

## Assumptions

- Unknown extra fields on a check are silently ignored.
- `evidence: null` is treated as invalid data (not as a missing key); the key must be absent or hold a string.
- Check ids are compared exactly, case-sensitive, without trimming whitespace.
- Status values are case-sensitive (`passed` is valid; `Passed` is not).
- A required check that fails and lacks evidence produces two separate blockers (one for status, one for evidence).
- File picker auto-runs the check immediately; textarea requires clicking "Check release".
- Result area is cleared before each new check, so a stale READY result is never displayed.

## Known limitations

- No persistence; results exist only in the browser session.
- Single report at a time; loading a new report replaces the previous one.
- No schema versioning; changes to the data contract would require code updates.
- No evidence verification by design; evidence is treated as a reference string only.
- Large files (several MB) are rendered in a single table without pagination.
- Tested in Chromium only.
- Needs Node.js and `npm install` to run; it is not a single static file.

## Tools and AI used

Claude Code (Anthropic) was used to draft the code, tests, and this README from the brief. TypeScript 5 in strict mode, Vite 7 for the dev server and build, and Vitest 3 for tests. Node 22 was used for development. Playwright/Chromium was used for browser smoke testing. The candidate reviewed and verified all output.

## What I verified myself

- Ran `npm run typecheck` with no errors and `npm test`: 55 of 55 tests passed.
- Ran `npm run build` and confirmed the production bundle builds.
- Loaded the supplied sample in the browser and saw BLOCKED with the two expected blockers (Payment workflow failed; Audit trail missing evidence) and one warning (UI text check failed).
- Loaded an all-required-passed report and saw READY with no blockers.
- Pasted malformed JSON and saw a clear error message with no stale result displayed.
- Read every function in `src/checker.ts` and can explain each one.

## Tests

The test suite in `test/checker.test.ts` uses Vitest with reproducible test fixtures. Run `npm test` to execute all cases. The table below is a summary; the two suites hold 55 tests in total. Last run: 55 passed, 0 failed.

| Test | Input (fixture) | Expected | Actual |
|------|-----------------|----------|--------|
| Sample release (supplied) | sample-release.json | BLOCKED, 2 blockers (payments failed, audit no evidence), 1 warning (copy failed) | passes (see npm test) |
| All required passed | all-required-passed.json | READY with no blockers | passes (see npm test) |
| Ready with optional warnings | ready-with-optional-warnings.json | READY with 1+ warnings | passes (see npm test) |
| Empty checks | empty-checks.json | BLOCKED (no required checks) | passes (see npm test) |
| Only optional | only-optional.json | BLOCKED (no required checks) | passes (see npm test) |
| Whitespace evidence | whitespace-evidence.json | BLOCKED (required check, no nonblank evidence) | passes (see npm test) |
| Duplicate id | duplicate-id.json | BLOCKED (invalid data) | passes (see npm test) |
| Invalid data in an optional check | optional-invalid-required.json | BLOCKED (invalid data blocks even when the check is optional) | passes (see npm test) |
| Status "Passed" (wrong case) | bad-status-case.json | BLOCKED (invalid data, case-sensitive) | passes (see npm test) |
| Evidence null (invalid type) | evidence-null.json | BLOCKED (invalid data) | passes (see npm test) |
| Malformed JSON | malformed.json.txt | BLOCKED with parse error message | passes (see npm test) |
