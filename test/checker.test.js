import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { checkRelease, validateReport, evaluateReadiness, parseJson } from '../src/checker.js';

const fixtureText = (name) =>
  fs.readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const load = (name) => fixtureText(`${name}.json`);

const NO_REQUIRED =
  'No required checks found. At least one required check must exist.';

const ALL_FIXTURES = [
  'sample-release.json',
  'all-required-passed.json',
  'ready-with-optional-warnings.json',
  'empty-checks.json',
  'only-optional.json',
  'whitespace-evidence.json',
  'missing-evidence-key.json',
  'duplicate-id.json',
  'bad-status-case.json',
  'optional-invalid-required.json',
  'evidence-null.json',
  'malformed.json.txt',
];

describe('the supplied sample report', () => {
  const result = checkRelease(load('sample-release'));

  it('blocks the supplied sample with two blockers and one warning', () => {
    expect(result.status).toBe('BLOCKED');
    expect(result.kind).toBe('ok');
    expect(result.blockers).toHaveLength(2);
    expect(result.warnings).toHaveLength(1);
  });

  it('reports the release name and keeps all four checks', () => {
    expect(result.release).toBe('customer-demo-v1');
    expect(result.checks.length).toBe(4);
  });

  it('explains that the payment workflow failed', () => {
    expect(result.blockers[0]).toBe(
      'Required check "Payment workflow" (payments) has status "failed"; it must be "passed".'
    );
  });

  it('explains that the audit trail has no evidence', () => {
    expect(result.blockers[1]).toBe(
      'Required check "Audit trail" (audit) has no evidence.'
    );
  });

  it('shows the failed UI text check as a warning, not a blocker', () => {
    expect(result.warnings).toEqual(['Optional check "UI text check" (copy) has status "failed".']);
    expect(result.blockers.join('\n')).not.toContain('UI text check');
  });
});

describe('reports that are ready', () => {
  it('is READY with no blockers or warnings when every required check passed with evidence', () => {
    const result = checkRelease(load('all-required-passed'));
    expect(result.status).toBe('READY');
    expect(result.kind).toBe('ok');
    expect(result.blockers).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('is still READY when optional checks failed or were not run, but warns about both', () => {
    const result = checkRelease(load('ready-with-optional-warnings'));
    expect(result.status).toBe('READY');
    expect(result.blockers).toEqual([]);
    expect(result.warnings).toHaveLength(2);
    expect(result.warnings).toEqual([
      'Optional check "UI text check" (copy) has status "failed".',
      'Optional check "Performance check" (perf) has status "not_run".',
    ]);
  });

  it('gives the same READY answer when the readiness step is called directly', () => {
    const parsed = parseJson(load('all-required-passed'));
    expect(parsed.ok).toBe(true);
    const outcome = evaluateReadiness(parsed.data);
    expect(outcome.status).toBe('READY');
    expect(outcome.blockers).toEqual([]);
    expect(outcome.warnings).toEqual([]);
  });
});

describe('reports with no required checks', () => {
  it('blocks a report with an empty checks list', () => {
    const result = checkRelease(load('empty-checks'));
    expect(result.status).toBe('BLOCKED');
    expect(result.kind).toBe('ok');
    expect(result.blockers).toEqual([NO_REQUIRED]);
  });

  it('blocks a report where every check is optional, with no warnings since they all passed', () => {
    const result = checkRelease(load('only-optional'));
    expect(result.status).toBe('BLOCKED');
    expect(result.kind).toBe('ok');
    expect(result.blockers).toEqual([NO_REQUIRED]);
    expect(result.warnings).toEqual([]);
  });
});

describe('required checks and their evidence', () => {
  it('treats whitespace-only evidence as missing evidence', () => {
    const result = checkRelease(load('whitespace-evidence'));
    expect(result.status).toBe('BLOCKED');
    expect(result.kind).toBe('ok');
    expect(result.blockers).toEqual([
      'Required check "Customer login" (login) has no evidence.',
    ]);
  });

  it('treats a missing evidence field as missing evidence', () => {
    const result = checkRelease(load('missing-evidence-key'));
    expect(result.status).toBe('BLOCKED');
    expect(result.kind).toBe('ok');
    expect(result.blockers).toEqual([
      'Required check "Customer login" (login) has no evidence.',
    ]);
  });

  it('gives two blockers, status first, when a required check failed and also has blank evidence', () => {
    const text = JSON.stringify({
      release: 'double-trouble',
      checks: [
        { id: 'pay', name: 'Payments', required: true, status: 'failed', evidence: '   ' },
      ],
    });
    const result = checkRelease(text);
    expect(result.status).toBe('BLOCKED');
    expect(result.blockers).toEqual([
      'Required check "Payments" (pay) has status "failed"; it must be "passed".',
      'Required check "Payments" (pay) has no evidence.',
    ]);
  });

  it('blocks a required check that was not run', () => {
    const text = JSON.stringify({
      release: 'not-run-release',
      checks: [
        { id: 'a', name: 'Alpha', required: true, status: 'passed', evidence: 'run-1' },
        { id: 'b', name: 'Beta', required: true, status: 'not_run', evidence: 'run-2' },
      ],
    });
    const result = checkRelease(text);
    expect(result.status).toBe('BLOCKED');
    expect(result.kind).toBe('ok');
    expect(result.blockers).toEqual([
      'Required check "Beta" (b) has status "not_run"; it must be "passed".',
    ]);
  });

  it('only reads evidence as text and never claims it was verified', () => {
    const text = JSON.stringify({
      release: 'link-release',
      checks: [
        {
          id: 'a',
          name: 'Alpha',
          required: true,
          status: 'passed',
          evidence: 'https://example.invalid/never-fetched',
        },
      ],
    });
    const result = checkRelease(text);
    expect(result.status).toBe('READY');
    const everything = [...result.blockers, ...result.warnings].join('\n').toLowerCase();
    expect(everything).not.toContain('verified');
  });
});

describe('invalid data', () => {
  it('blocks a duplicate id and points at the second occurrence', () => {
    const result = checkRelease(load('duplicate-id'));
    expect(result.status).toBe('BLOCKED');
    expect(result.kind).toBe('invalid_data');
    expect(result.blockers).toContain('checks[1]: duplicate id "login".');
    expect(result.blockers).not.toContain('checks[0]: duplicate id "login".');
  });

  it('blocks a status written with the wrong capital letters and quotes what it got', () => {
    const result = checkRelease(load('bad-status-case'));
    expect(result.status).toBe('BLOCKED');
    expect(result.kind).toBe('invalid_data');
    expect(result.blockers).toContain(
      'checks[0] (login): "status" must be one of passed, failed, not_run (got "Passed").'
    );
  });

  it('blocks the whole report when an optional check has invalid data', () => {
    const result = checkRelease(load('optional-invalid-required'));
    expect(result.status).toBe('BLOCKED');
    expect(result.kind).toBe('invalid_data');
    expect(result.blockers).toContain(
      'checks[1] (copy): "required" must be true or false.'
    );
  });

  it('blocks evidence that is null instead of a string', () => {
    const result = checkRelease(load('evidence-null'));
    expect(result.status).toBe('BLOCKED');
    expect(result.kind).toBe('invalid_data');
    expect(result.blockers).toContain(
      'checks[0] (login): "evidence" must be a string if present.'
    );
  });

  it('does not show release or checks for invalid data', () => {
    const result = checkRelease(load('evidence-null'));
    expect(result.checks).toEqual([]);
  });

  it.each([
    ['an empty list', '[]'],
    ['null', 'null'],
    ['a number', '42'],
    ['a string', '"str"'],
  ])('rejects %s as the top level of the report', (_label, text) => {
    const result = checkRelease(text);
    expect(result.status).toBe('BLOCKED');
    expect(result.kind).toBe('invalid_data');
    expect(result.blockers).toEqual(['Root must be a JSON object.']);
    expect(result.release).toBeNull();
    expect(result.checks).toEqual([]);
  });
});

describe('malformed input', () => {
  it('blocks text that is not valid JSON and shows the parser message', () => {
    const result = checkRelease(fixtureText('malformed.json.txt'));
    expect(result.status).toBe('BLOCKED');
    expect(result.kind).toBe('invalid_json');
    expect(result.blockers).toHaveLength(1);
    expect(result.blockers[0].startsWith('Invalid JSON: ')).toBe(true);
    expect(result.checks).toEqual([]);
    expect(result.release).toBeNull();
  });

  it('treats an empty string as invalid JSON without throwing', () => {
    let result;
    expect(() => {
      result = checkRelease('');
    }).not.toThrow();
    expect(result.status).toBe('BLOCKED');
    expect(result.kind).toBe('invalid_json');
    expect(result.blockers[0].startsWith('Invalid JSON: ')).toBe(true);
  });

  it('parseJson reports a failure instead of throwing', () => {
    const parsed = parseJson(fixtureText('malformed.json.txt'));
    expect(parsed.ok).toBe(false);
    expect(typeof parsed.error).toBe('string');
  });

  it('parseJson returns the data for valid JSON', () => {
    const parsed = parseJson('{"a": 1}');
    expect(parsed).toEqual({ ok: true, data: { a: 1 } });
  });
});

describe('validateReport', () => {
  it('returns no errors for a valid report', () => {
    expect(validateReport(JSON.parse(load('all-required-passed')))).toEqual([]);
  });

  it('collects several errors at once instead of stopping at the first', () => {
    const report = {
      release: '   ',
      checks: [{ id: 'a', name: 'Alpha', required: true, status: 'bogus', evidence: 'x' }],
    };
    const errors = validateReport(report);
    expect(errors).toHaveLength(2);
    expect(errors).toContain('"release" must be a nonblank string.');
    expect(errors).toContain(
      'checks[0] (a): "status" must be one of passed, failed, not_run (got "bogus").'
    );
  });
});

describe('every result follows the same rule', () => {
  it.each(ALL_FIXTURES)('is READY only when there are no blockers (%s)', (name) => {
    const result = checkRelease(fixtureText(name));
    expect(result.status === 'READY').toBe(result.blockers.length === 0);
    expect(['READY', 'BLOCKED']).toContain(result.status);
  });
});
