// Browser UI. All logic lives in checker.js; this file only reads input and draws the Result.
// Security: the JSON is untrusted, so we only ever use textContent / createElement (never innerHTML).
import { checkRelease } from './checker.js';

const input = document.getElementById('json-input');
const fileInput = document.getElementById('file-input');
const resultBox = document.getElementById('result');

// Tiny DOM helper: el('p', { class: 'x' }, ['text', otherNode]).
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  for (const child of [].concat(children)) {
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

function clearResult() {
  resultBox.replaceChildren();
}

function renderBanner(status, release) {
  const kids = [status];
  if (release) kids.push(el('small', {}, `Release: ${release}`));
  return el('div', { class: `banner banner--${status === 'READY' ? 'ready' : 'blocked'}` }, kids);
}

function renderList(title, items) {
  const body = items.length ? el('ul', {}, items.map((text) => el('li', {}, text))) : el('p', { class: 'muted' }, 'None');
  return [el('h2', {}, title), body];
}

function renderReasons(result) {
  if (result.kind === 'invalid_json') {
    return [el('h2', {}, 'Malformed JSON'), el('p', {}, result.blockers[0] || 'Invalid JSON.')];
  }
  if (result.kind === 'invalid_data') {
    return [el('h2', {}, 'Invalid data'), el('ul', {}, result.blockers.map((text) => el('li', {}, text)))];
  }
  return [...renderList('Blocking reasons', result.blockers), ...renderList('Warnings', result.warnings)];
}

function hasEvidence(check) {
  return typeof check.evidence === 'string' && check.evidence.trim() !== '';
}

function rowClass(check) {
  if (check.required && (check.status !== 'passed' || !hasEvidence(check))) return 'row--blocker';
  if (!check.required && check.status !== 'passed') return 'row--warning';
  return '';
}

function renderCheckRow(check) {
  const evidence = hasEvidence(check) ? check.evidence : el('span', { class: 'muted' }, '(none)');
  return el('tr', { class: rowClass(check) }, [
    el('td', {}, check.id),
    el('td', {}, check.name),
    el('td', {}, check.required ? 'Yes' : 'No'),
    el('td', { class: `status--${check.status}` }, check.status),
    el('td', {}, evidence),
  ]);
}

function renderChecksTable(checks) {
  const head = el('thead', {}, el('tr', {}, ['ID', 'Name', 'Required', 'Status', 'Evidence'].map((h) => el('th', {}, h))));
  const body = el('tbody', {}, checks.map(renderCheckRow));
  return el('div', { class: 'table-wrap' }, el('table', {}, [head, body]));
}

function renderResult(result) {
  clearResult();
  resultBox.append(renderBanner(result.status, result.release), ...renderReasons(result));
  if (result.kind === 'ok') {
    resultBox.append(el('h2', {}, 'Checks'), renderChecksTable(result.checks));
  }
}

function renderUnexpectedError(error) {
  clearResult();
  resultBox.append(renderBanner('BLOCKED', null), el('p', {}, `Unexpected error: ${error && error.message ? error.message : error}`));
}

// Clear first so a stale READY can never stay visible, even if the check throws.
function runCheck() {
  clearResult();
  try {
    renderResult(checkRelease(input.value));
  } catch (error) {
    renderUnexpectedError(error);
  }
}

function handleFile() {
  clearResult();
  const file = fileInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    input.value = String(reader.result);
    fileInput.value = ''; // allow re-selecting the same file
    runCheck();
  };
  reader.onerror = () => renderUnexpectedError(reader.error || new Error('Could not read file'));
  reader.readAsText(file);
}

async function loadSample() {
  try {
    const response = await fetch('./sample-release.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    input.value = await response.text(); // loaded only; the user clicks "Check release"
  } catch (error) {
    renderUnexpectedError(new Error(`Could not load sample: ${error.message}`));
  }
}

function resetAll() {
  input.value = '';
  fileInput.value = '';
  resultBox.replaceChildren(el('p', { class: 'muted' }, 'No report checked yet.'));
}

document.getElementById('check-btn').addEventListener('click', runCheck);
document.getElementById('load-sample').addEventListener('click', loadSample);
document.getElementById('clear-btn').addEventListener('click', resetAll);
fileInput.addEventListener('change', handleFile);
