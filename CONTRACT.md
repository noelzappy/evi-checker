# Module contract: `src/checker.ts`

Pure TypeScript module. No DOM access, no I/O, no fetching. Browser (via Vite) and vitest both import it. Exported types: `Status`, `Check`, `Report`, `Verdict`, `ResultKind`, `ParseResult`, `Readiness`, `Result`.

```js
export const STATUSES = ['passed', 'failed', 'not_run'];

// Step 1. Parse text. Never throws.
export function parseJson(text)
// -> { ok: true, data } | { ok: false, error: string }   // error is JSON.parse's message

// Step 2. Validate the data contract. Returns [] when valid.
// Checks EVERY check (optional ones too) and collects ALL errors, not just the first.
export function validateReport(data)  // -> string[]

// Type guard, true exactly when validateReport returns [].
export function isValidReport(data: unknown): data is Report

// Step 3. Readiness. Takes a Report, so callers narrow with isValidReport first.
export function evaluateReadiness(report: Report)
// -> { status: 'READY' | 'BLOCKED', blockers: string[], warnings: string[] }

// Step 4. One-shot entry point used by the UI. Never throws.
export function checkRelease(text)   // -> Result
```

## Result shape (from `checkRelease`)

```js
{
  status:   'READY' | 'BLOCKED',
  kind:     'ok' | 'invalid_json' | 'invalid_data',
  release:  string | null,   // null unless data.release was a nonblank string
  checks:   Check[],         // the supplied checks array when kind === 'ok'; [] otherwise
  blockers: string[],        // every blocking reason, human-readable; empty iff status === 'READY'
  warnings: string[],        // optional failed / not_run checks; may be non-empty when READY
}
```

- `kind === 'invalid_json'`  → `status: 'BLOCKED'`, `blockers: ['Invalid JSON: <parser message>']`.
- `kind === 'invalid_data'`  → `status: 'BLOCKED'`, `blockers` = every validation message.
- `kind === 'ok'`            → `status`, `blockers`, `warnings` from `evaluateReadiness`.

## Validation rules (produce `invalid_data`)

Root must be an object (not null, not array). `release` must be a nonblank string. `checks` must be an array.
Each element of `checks`:
- must be an object (not null, not array)
- `id`: nonblank string, unique across the array (whitespace-only is blank)
- `name`: nonblank string
- `required`: JSON boolean (`true`/`false` only; `"true"`, `1` are invalid)
- `status`: exactly `passed`, `failed`, or `not_run` (case-sensitive; `"Passed"` is invalid)
- `evidence`: a string, or the key is absent. `null`, numbers, objects are invalid.
- Unknown extra fields are ignored.

Message formats (exact strings, so tests and UI agree):
- `Root must be a JSON object.`
- `"release" must be a nonblank string.`
- `"checks" must be an array.`
- `checks[i]: must be an object.`
- `checks[i]: "id" must be a nonblank string.`
- `checks[i]: duplicate id "<id>".`                          (reported on the 2nd and later occurrences)
- `checks[i] (<id>): "name" must be a nonblank string.`
- `checks[i] (<id>): "required" must be true or false.`
- `checks[i] (<id>): "status" must be one of passed, failed, not_run (got <JSON.stringify(value)>).`
- `checks[i] (<id>): "evidence" must be a string if present.`
`(<id>)` is included only when `id` is a nonblank string; otherwise omit the parenthetical.

## Readiness rules (only run on valid data)

Blockers, in this order, in array order of checks:
- If no check has `required === true`:
  `No required checks found. At least one required check must exist.`
- For each required check whose status !== 'passed':
  `Required check "<name>" (<id>) has status "<status>"; it must be "passed".`
- For each required check whose evidence is absent or whitespace-only:
  `Required check "<name>" (<id>) has no evidence.`
  (A single check can produce both of the above.)

Warnings, for each optional check (`required === false`) whose status !== 'passed':
- `Optional check "<name>" (<id>) has status "<status>".`

`status` is `'READY'` iff `blockers.length === 0`.

Evidence is only a reference string. Never fetch it, never claim it was verified.

## Expected result for `sample-release.json`

BLOCKED, kind `ok`, release `customer-demo-v1`, 2 blockers (payments failed; audit no evidence), 1 warning (copy failed).
