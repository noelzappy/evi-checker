// Browser UI. All logic lives in checker.ts; this file only reads input and draws the Result.
// Security: the JSON is untrusted, so we only ever use textContent / createElement (never innerHTML).
import { checkRelease, type Check, type Result, type Verdict } from './checker';
// Vite inlines the sample as a string at build time, so no fetch is needed.
import sampleText from '../sample-release.json?raw';

function byId<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing element #${id}`);
  return node as T;
}

const input = byId<HTMLTextAreaElement>('json-input');
const fileInput = byId<HTMLInputElement>('file-input');
const resultBox = byId<HTMLDivElement>('result');

type Child = Node | string | number;

// Tiny DOM helper: el('p', { class: 'x' }, ['text', otherNode]).
function el(tag: string, attrs: Record<string, string> = {}, children: Child | Child[] = []): HTMLElement {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  for (const child of ([] as Child[]).concat(children)) {
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

function clearResult(): void {
  resultBox.replaceChildren();
}

function renderBanner(status: Verdict, release: string | null): HTMLElement {
  const kids: Child[] = [status];
  if (release) kids.push(el('small', {}, `Release: ${release}`));
  return el('div', { class: `banner banner--${status === 'READY' ? 'ready' : 'blocked'}` }, kids);
}

function renderList(title: string, items: string[]): HTMLElement[] {
  const body = items.length
    ? el('ul', {}, items.map((text) => el('li', {}, text)))
    : el('p', { class: 'muted' }, 'None');
  return [el('h2', {}, title), body];
}

function renderReasons(result: Result): HTMLElement[] {
  if (result.kind === 'invalid_json') {
    return [el('h2', {}, 'Malformed JSON'), el('p', {}, result.blockers[0] ?? 'Invalid JSON.')];
  }
  if (result.kind === 'invalid_data') {
    return [el('h2', {}, 'Invalid data'), el('ul', {}, result.blockers.map((text) => el('li', {}, text)))];
  }
  return [...renderList('Blocking reasons', result.blockers), ...renderList('Warnings', result.warnings)];
}

function hasEvidence(check: Check): boolean {
  return typeof check.evidence === 'string' && check.evidence.trim() !== '';
}

function rowClass(check: Check): string {
  if (check.required && (check.status !== 'passed' || !hasEvidence(check))) return 'row--blocker';
  if (!check.required && check.status !== 'passed') return 'row--warning';
  return '';
}

function renderCheckRow(check: Check): HTMLElement {
  const evidence: Child = hasEvidence(check) ? (check.evidence as string) : el('span', { class: 'muted' }, '(none)');
  return el('tr', { class: rowClass(check) }, [
    el('td', {}, check.id),
    el('td', {}, check.name),
    el('td', {}, check.required ? 'Yes' : 'No'),
    el('td', { class: `status--${check.status}` }, check.status),
    el('td', {}, evidence),
  ]);
}

function renderChecksTable(checks: Check[]): HTMLElement {
  const headers = ['ID', 'Name', 'Required', 'Status', 'Evidence'];
  const head = el('thead', {}, el('tr', {}, headers.map((h) => el('th', {}, h))));
  const body = el('tbody', {}, checks.map(renderCheckRow));
  return el('div', { class: 'table-wrap' }, el('table', {}, [head, body]));
}

function renderResult(result: Result): void {
  clearResult();
  resultBox.append(renderBanner(result.status, result.release), ...renderReasons(result));
  if (result.kind === 'ok') {
    resultBox.append(el('h2', {}, 'Checks'), renderChecksTable(result.checks));
  }
}

function renderUnexpectedError(error: unknown): void {
  clearResult();
  const message = error instanceof Error ? error.message : String(error);
  resultBox.append(renderBanner('BLOCKED', null), el('p', {}, `Unexpected error: ${message}`));
}

// Clear first so a stale READY can never stay visible, even if the check throws.
function runCheck(): void {
  clearResult();
  try {
    renderResult(checkRelease(input.value));
  } catch (error) {
    renderUnexpectedError(error);
  }
}

function handleFile(): void {
  clearResult();
  const file = fileInput.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    input.value = String(reader.result);
    fileInput.value = ''; // allow re-selecting the same file
    runCheck();
  };
  reader.onerror = () => renderUnexpectedError(reader.error ?? new Error('Could not read file'));
  reader.readAsText(file);
}

function loadSample(): void {
  input.value = sampleText; // loaded only; the user clicks "Check release"
}

function resetAll(): void {
  input.value = '';
  fileInput.value = '';
  resultBox.replaceChildren(el('p', { class: 'muted' }, 'No report checked yet.'));
}

byId<HTMLButtonElement>('check-btn').addEventListener('click', runCheck);
byId<HTMLButtonElement>('load-sample').addEventListener('click', loadSample);
byId<HTMLButtonElement>('clear-btn').addEventListener('click', resetAll);
fileInput.addEventListener('change', handleFile);
