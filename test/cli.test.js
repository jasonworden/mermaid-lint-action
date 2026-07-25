'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { CLI_PACKAGE, buildNpxArgs, readSummary, formatSummary } = require('../src/cli.js');

test('defaults produce an unpinned, non-strict json invocation', () => {
  assert.deepEqual(buildNpxArgs(), ['--yes', CLI_PACKAGE, '--format', 'json']);
});

test('version is appended as an npm spec', () => {
  const args = buildNpxArgs({ version: '^0.35.1' });
  assert.equal(args[1], `${CLI_PACKAGE}@^0.35.1`);
});

test('empty version leaves the package unpinned', () => {
  assert.equal(buildNpxArgs({ version: '' })[1], CLI_PACKAGE);
});

test('an exact version pins exactly', () => {
  assert.equal(buildNpxArgs({ version: '0.35.1' })[1], `${CLI_PACKAGE}@0.35.1`);
});

test('strict adds --strict', () => {
  assert.ok(buildNpxArgs({ strict: true }).includes('--strict'));
  assert.ok(!buildNpxArgs({ strict: false }).includes('--strict'));
});

test('files are split on arbitrary whitespace', () => {
  const args = buildNpxArgs({ files: 'docs/**/*.md   **/*.mmd\n\tREADME.md' });
  assert.deepEqual(args.slice(4), ['docs/**/*.md', '**/*.mmd', 'README.md']);
});

test('blank files input contributes no arguments', () => {
  assert.deepEqual(buildNpxArgs({ files: '   ' }), ['--yes', CLI_PACKAGE, '--format', 'json']);
});

test('--format json precedes the file list so globs are never read as flags values', () => {
  const args = buildNpxArgs({ files: 'a.md', strict: true, version: '1.0.0' });
  assert.deepEqual(args, ['--yes', `${CLI_PACKAGE}@1.0.0`, '--format', 'json', '--strict', 'a.md']);
});

test('readSummary tolerates a missing summary block', () => {
  assert.deepEqual(readSummary({}), { files: 0, diagrams: 0, errors: 0, warnings: 0 });
});

test('readSummary tolerates a partial summary block', () => {
  assert.deepEqual(readSummary({ summary: { diagrams: 3 } }), {
    files: 0, diagrams: 3, errors: 0, warnings: 0,
  });
});

test('readSummary passes through a full summary', () => {
  const s = { files: 2, diagrams: 4, errors: 1, warnings: 3, ok: 3, types: {} };
  assert.deepEqual(readSummary({ summary: s }), { files: 2, diagrams: 4, errors: 1, warnings: 3 });
});

test('readSummary preserves an explicit zero rather than masking it', () => {
  assert.equal(readSummary({ summary: { errors: 0 } }).errors, 0);
});

test('formatSummary renders counts in a stable sentence', () => {
  assert.equal(
    formatSummary({ files: 2, diagrams: 4, errors: 1, warnings: 3 }),
    'Checked 4 diagram(s) in 2 file(s) — 1 error(s), 3 warning(s)',
  );
});
