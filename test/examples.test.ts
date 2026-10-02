// Keeps the manual-testing reports in examples/ honest: each file name promises
// a verdict, and this test checks that the checker agrees.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { checkRelease, type ResultKind, type Verdict } from '../src/checker';

const EXAMPLES_DIR = new URL('../examples/', import.meta.url);

interface Expectation {
  status: Verdict;
  kind: ResultKind;
  blockers: number;
  warnings: number;
}

const EXPECTED: Record<string, Expectation> = {
  '01-ready-all-required-passed.json':        { status: 'READY',   kind: 'ok',           blockers: 0, warnings: 0 },
  '02-ready-with-optional-warnings.json':     { status: 'READY',   kind: 'ok',           blockers: 0, warnings: 2 },
  '03-blocked-required-failed.json':          { status: 'BLOCKED', kind: 'ok',           blockers: 3, warnings: 0 },
  '04-blocked-missing-evidence.json':         { status: 'BLOCKED', kind: 'ok',           blockers: 2, warnings: 0 },
  '05-blocked-only-optional-checks.json':     { status: 'BLOCKED', kind: 'ok',           blockers: 1, warnings: 0 },
  '06-blocked-empty-checks.json':             { status: 'BLOCKED', kind: 'ok',           blockers: 1, warnings: 0 },
  '07-invalid-duplicate-id.json':             { status: 'BLOCKED', kind: 'invalid_data', blockers: 1, warnings: 0 },
  '08-invalid-wrong-types.json':              { status: 'BLOCKED', kind: 'invalid_data', blockers: 4, warnings: 0 },
  '09-invalid-optional-check-bad-status.json':{ status: 'BLOCKED', kind: 'invalid_data', blockers: 1, warnings: 0 },
  '10-invalid-missing-release.json':          { status: 'BLOCKED', kind: 'invalid_data', blockers: 1, warnings: 0 },
  '11-invalid-root-is-array.json':            { status: 'BLOCKED', kind: 'invalid_data', blockers: 1, warnings: 0 },
  '12-malformed-json.json':                   { status: 'BLOCKED', kind: 'invalid_json', blockers: 1, warnings: 0 },
};

describe('examples/ reports give the verdict their file name promises', () => {
  it('has an expectation for every file in examples/', () => {
    const files = fs.readdirSync(EXAMPLES_DIR).filter((f) => f.endsWith('.json')).sort();
    expect(files).toEqual(Object.keys(EXPECTED).sort());
  });

  for (const [file, expected] of Object.entries(EXPECTED)) {
    it(`${file} -> ${expected.status} (${expected.kind})`, () => {
      const text = fs.readFileSync(new URL(file, EXAMPLES_DIR), 'utf8');
      const result = checkRelease(text);
      expect(result.status).toBe(expected.status);
      expect(result.kind).toBe(expected.kind);
      expect(result.blockers).toHaveLength(expected.blockers);
      expect(result.warnings).toHaveLength(expected.warnings);
    });
  }
});
