// Release evidence checker: pure logic, no DOM, no I/O, no dependencies.
// Browser (app.ts) and the vitest suite both import this module.

// ---- types ---------------------------------------------------------------

/** The only allowed values for a check's "status" (case-sensitive). */
export const STATUSES = ['passed', 'failed', 'not_run'] as const;
export type Status = (typeof STATUSES)[number];

/** One entry of the report's "checks" array, after validation. */
export interface Check {
  id: string;
  name: string;
  required: boolean;
  status: Status;
  evidence?: string;
}

/** A release report that has passed validateReport. */
export interface Report {
  release: string;
  checks: Check[];
}

export type Verdict = 'READY' | 'BLOCKED';
export type ResultKind = 'ok' | 'invalid_json' | 'invalid_data';

export type ParseResult = { ok: true; data: unknown } | { ok: false; error: string };

export interface Readiness {
  status: Verdict;
  blockers: string[];
  warnings: string[];
}

/** What checkRelease returns; the UI renders exactly this. */
export interface Result extends Readiness {
  kind: ResultKind;
  release: string | null;
  checks: Check[];
}

// ---- small helpers -------------------------------------------------------

type PlainObject = Record<string, unknown>;

/** True for {} style objects; false for null, arrays and primitives. */
function isPlainObject(v: unknown): v is PlainObject {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** True when v is not a string, or is empty / whitespace-only. */
function isBlank(v: unknown): boolean {
  return typeof v !== 'string' || v.trim() === '';
}

/** True when v is a string with at least one non-whitespace character. */
function isNonBlankString(v: unknown): v is string {
  return !isBlank(v);
}

function isStatus(v: unknown): v is Status {
  return (STATUSES as readonly unknown[]).includes(v);
}

/** "(<id>)" label used in messages, or "" when the id is not usable. */
function idLabel(check: PlainObject): string {
  return isNonBlankString(check.id) ? ` (${check.id})` : '';
}

/** Validates one element of "checks"; returns its error messages. */
function validateCheck(check: unknown, i: number, seenIds: Set<string>): string[] {
  if (!isPlainObject(check)) return [`checks[${i}]: must be an object.`];

  const errors: string[] = [];
  const prefix = `checks[${i}]${idLabel(check)}:`;

  if (!isNonBlankString(check.id)) {
    errors.push(`checks[${i}]: "id" must be a nonblank string.`);
  } else if (seenIds.has(check.id)) {
    errors.push(`checks[${i}]: duplicate id "${check.id}".`);
  } else {
    seenIds.add(check.id);
  }

  if (!isNonBlankString(check.name)) {
    errors.push(`${prefix} "name" must be a nonblank string.`);
  }
  if (typeof check.required !== 'boolean') {
    errors.push(`${prefix} "required" must be true or false.`);
  }
  if (!isStatus(check.status)) {
    errors.push(
      `${prefix} "status" must be one of ${STATUSES.join(', ')} (got ${JSON.stringify(check.status)}).`,
    );
  }
  if (Object.hasOwn(check, 'evidence') && typeof check.evidence !== 'string') {
    errors.push(`${prefix} "evidence" must be a string if present.`);
  }
  return errors;
}

// ---- exports -------------------------------------------------------------

/** Step 1: parse JSON text. Never throws; returns { ok, data } or { ok, error }. */
export function parseJson(text: string): ParseResult {
  try {
    return { ok: true, data: JSON.parse(text) as unknown };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Step 2: check the data contract. Returns every error found ([] when valid). */
export function validateReport(data: unknown): string[] {
  if (!isPlainObject(data)) return ['Root must be a JSON object.'];

  const errors: string[] = [];
  if (!isNonBlankString(data.release)) {
    errors.push('"release" must be a nonblank string.');
  }
  if (!Array.isArray(data.checks)) {
    errors.push('"checks" must be an array.');
    return errors;
  }

  const seenIds = new Set<string>();
  data.checks.forEach((check: unknown, i: number) => {
    errors.push(...validateCheck(check, i, seenIds));
  });
  return errors;
}

/** Type guard: true exactly when validateReport finds no errors. */
export function isValidReport(data: unknown): data is Report {
  return validateReport(data).length === 0;
}

/** Step 3: apply the readiness rules to a report that already passed validation. */
export function evaluateReadiness(report: Report): Readiness {
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (!report.checks.some((c) => c.required)) {
    blockers.push('No required checks found. At least one required check must exist.');
  }

  for (const c of report.checks) {
    const who = `"${c.name}" (${c.id})`;
    if (c.required) {
      if (c.status !== 'passed') {
        blockers.push(`Required check ${who} has status "${c.status}"; it must be "passed".`);
      }
      if (isBlank(c.evidence)) {
        blockers.push(`Required check ${who} has no evidence.`);
      }
    } else if (c.status !== 'passed') {
      warnings.push(`Optional check ${who} has status "${c.status}".`);
    }
  }

  return { status: blockers.length === 0 ? 'READY' : 'BLOCKED', blockers, warnings };
}

/** Step 4: one-shot entry point for the UI: parse, validate, evaluate. Never throws. */
export function checkRelease(text: string): Result {
  const parsed = parseJson(text);
  if (!parsed.ok) {
    return {
      status: 'BLOCKED', kind: 'invalid_json', release: null, checks: [],
      blockers: [`Invalid JSON: ${parsed.error}`], warnings: [],
    };
  }

  const data = parsed.data;
  const release = isPlainObject(data) && isNonBlankString(data.release) ? data.release : null;

  const errors = validateReport(data);
  if (errors.length > 0 || !isValidReport(data)) {
    return {
      status: 'BLOCKED', kind: 'invalid_data', release, checks: [],
      blockers: errors, warnings: [],
    };
  }

  const { status, blockers, warnings } = evaluateReadiness(data);
  return { status, kind: 'ok', release, checks: data.checks, blockers, warnings };
}
