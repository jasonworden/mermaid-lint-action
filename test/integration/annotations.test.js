'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { readFileSync, existsSync } = require('node:fs');
const { resolve } = require('node:path');

// End-to-end coverage for the thing unit tests structurally cannot reach: that
// the real CLI's line offsets, run through the real bundle, land on the real
// source line. The unit tests assert against frozen JSON someone typed by hand,
// so a CLI release that changed its own offset convention would leave them
// green while every consumer's annotations silently drifted by a line.
//
// Expected line numbers are derived by searching the fixture for a marker
// rather than hard-coded, so editing a fixture cannot put this out of date.

const root = resolve(__dirname, '..', '..');
const BUNDLE = resolve(root, 'dist', 'index.js');
const PINNED_CLI = '^0.35.1';

/**
 * Finds a line inside the fixture's mermaid block.
 *
 * Scoped to the fenced block on purpose: these fixtures explain themselves in
 * prose above the diagram, and that prose quotes the very markers searched for
 * here. An unscoped search matches the explanation instead of the code.
 *
 * @param {string} fixture - path relative to the repo root
 * @param {string} marker - substring identifying the offending line
 * @returns {number} 1-based line number in the file
 */
function diagramLineContaining(fixture, marker) {
  const lines = readFileSync(resolve(root, fixture), 'utf8').split('\n');
  const open = lines.findIndex((line) => line.trim() === '```mermaid');
  assert.notEqual(open, -1, `no mermaid fence in ${fixture}`);
  const close = lines.findIndex((line, i) => i > open && line.trim() === '```');
  assert.notEqual(close, -1, `unterminated mermaid fence in ${fixture}`);

  const offset = lines.slice(open + 1, close).findIndex((line) => line.includes(marker));
  assert.notEqual(offset, -1, `no diagram line containing ${JSON.stringify(marker)} in ${fixture}`);
  return open + 2 + offset;
}

/**
 * Runs the built bundle the way the Actions runner does — inputs as INPUT_*
 * environment variables — and returns its workflow-command output.
 *
 * @param {{files: string, strict?: boolean}} inputs
 * @returns {{stdout: string, status: number}}
 */
function runAction({ files, strict = false }) {
  assert.ok(existsSync(BUNDLE), `${BUNDLE} is missing — run \`npm run build\` first.`);
  const env = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    'INPUT_FILES': files,
    'INPUT_STRICT': String(strict),
    'INPUT_VERSION': PINNED_CLI,
    'INPUT_WORKING-DIRECTORY': '.',
  };
  try {
    const stdout = execFileSync(process.execPath, [BUNDLE], { cwd: root, env, encoding: 'utf8' });
    return { stdout, status: 0 };
  } catch (err) {
    return { stdout: err.stdout ?? '', status: err.status ?? 1 };
  }
}

test('a clean fixture passes and emits no annotations', { timeout: 180000 }, () => {
  const { stdout, status } = runAction({ files: 'test/fixtures/valid.md', strict: true });
  assert.equal(status, 0, stdout);
  assert.doesNotMatch(stdout, /^::(error|warning)/m, stdout);
});

test('an error annotation lands on the offending line', { timeout: 180000 }, () => {
  const fixture = 'test/fixtures/invalid.md';
  const expected = diagramLineContaining(fixture, 'C -> D[Broken]');
  const { stdout, status } = runAction({ files: fixture });

  assert.equal(status, 1, stdout);
  const match = stdout.match(/^::error file=([^,]+),line=(\d+)::/m);
  assert.ok(match, `no error annotation in output:\n${stdout}`);
  assert.equal(match[1], fixture);
  assert.equal(
    Number(match[2]),
    expected,
    `annotation should point at the \`->\` on line ${expected}, not ${match[2]}`,
  );
});

test('a warning annotation lands on the offending line without strict', { timeout: 180000 }, () => {
  // Not gated on strict: duplicate-ids has severity "error", so the CLI fails
  // the run either way and an unannotated failure would be unexplainable.
  const fixture = 'test/fixtures/warning.md';
  const expected = diagramLineContaining(fixture, 'A[Duplicate Label]');
  const { stdout, status } = runAction({ files: fixture });

  assert.equal(status, 1, stdout);
  const match = stdout.match(/^::warning file=([^,]+),line=(\d+)::/m);
  assert.ok(match, `no warning annotation in output:\n${stdout}`);
  assert.equal(match[1], fixture);
  assert.equal(Number(match[2]), expected);
});
