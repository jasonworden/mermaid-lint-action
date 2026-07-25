'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  parseVersion,
  diffLevel,
  releaseAffectingPaths,
  evaluateVersionBump,
} = require('../scripts/check-version-bump.js');

test('parseVersion accepts a plain X.Y.Z', () => {
  assert.deepEqual(parseVersion('1.2.3'), [1, 2, 3]);
  assert.deepEqual(parseVersion('0.0.0'), [0, 0, 0]);
  assert.deepEqual(parseVersion('10.20.30'), [10, 20, 30]);
});

test('parseVersion rejects prereleases, ranges, and junk', () => {
  for (const bad of ['1.2', '1.2.3-beta.1', 'v1.2.3', '^1.2.3', '', null, undefined]) {
    assert.throws(() => parseVersion(bad), /Not a plain X\.Y\.Z version/);
  }
});

test('diffLevel classifies single-step increases', () => {
  assert.equal(diffLevel([1, 2, 3], [1, 2, 3]), 'none');
  assert.equal(diffLevel([1, 2, 3], [1, 2, 4]), 'patch');
  assert.equal(diffLevel([1, 2, 3], [1, 3, 0]), 'minor');
  assert.equal(diffLevel([1, 2, 3], [2, 0, 0]), 'major');
});

test('diffLevel rejects decreases', () => {
  assert.equal(diffLevel([1, 2, 3], [1, 2, 2]), 'invalid');
  assert.equal(diffLevel([2, 0, 0], [1, 9, 9]), 'invalid');
});

test('diffLevel rejects skipped versions', () => {
  assert.equal(diffLevel([1, 0, 0], [1, 0, 2]), 'invalid');
  assert.equal(diffLevel([1, 0, 0], [1, 2, 0]), 'invalid');
  assert.equal(diffLevel([1, 0, 0], [3, 0, 0]), 'invalid');
});

test('diffLevel rejects bumps that leave lower components set', () => {
  assert.equal(diffLevel([1, 2, 3], [2, 1, 0]), 'invalid');
  assert.equal(diffLevel([1, 2, 3], [2, 0, 1]), 'invalid');
  assert.equal(diffLevel([1, 2, 3], [1, 3, 1]), 'invalid');
});

test('releaseAffectingPaths picks out what consumers actually run', () => {
  assert.deepEqual(
    releaseAffectingPaths([
      'README.md',
      'src/annotate.js',
      '.github/workflows/ci.yml',
      'action.yml',
      'test/cli.test.js',
      'dist/index.js',
    ]),
    ['src/annotate.js', 'action.yml', 'dist/index.js'],
  );
});

test('releaseAffectingPaths exempts docs, CI, tests, and scripts', () => {
  assert.deepEqual(releaseAffectingPaths([
    'README.md',
    'LICENSE',
    '.gitignore',
    '.github/workflows/release.yml',
    'test/fixtures/valid.md',
    'scripts/check-version-bump.js',
  ]), []);
});

test('releaseAffectingPaths treats an unrecognised new path as released', () => {
  // The exempt-list is deliberately fail-closed: a path nobody thought about
  // requires a bump rather than silently producing no release.
  assert.deepEqual(
    releaseAffectingPaths(['bin/mermaid-lint-action', 'templates/report.hbs']),
    ['bin/mermaid-lint-action', 'templates/report.hbs'],
  );
});

test('a src change without a bump fails', () => {
  const r = evaluateVersionBump({
    baseVersion: '1.0.0', headVersion: '1.0.0', changedPaths: ['src/annotate.js'],
  });
  assert.equal(r.ok, false);
  assert.match(r.reason, /still 1\.0\.0/);
  assert.match(r.reason, /will not produce a release/);
});

test('a src change with a patch bump passes', () => {
  const r = evaluateVersionBump({
    baseVersion: '1.0.0', headVersion: '1.0.1', changedPaths: ['src/annotate.js', 'dist/index.js'],
  });
  assert.equal(r.ok, true);
});

test('a docs-only PR needs no bump', () => {
  const r = evaluateVersionBump({
    baseVersion: '1.0.0', headVersion: '1.0.0', changedPaths: ['README.md', 'LICENSE'],
  });
  assert.equal(r.ok, true);
  assert.match(r.reason, /no released files changed/);
});

test('a CI-only PR needs no bump', () => {
  const r = evaluateVersionBump({
    baseVersion: '1.0.0',
    headVersion: '1.0.0',
    changedPaths: ['.github/workflows/ci.yml', 'test/cli.test.js'],
  });
  assert.equal(r.ok, true);
});

test('a docs-only PR may still bump if it wants to', () => {
  const r = evaluateVersionBump({
    baseVersion: '1.0.0', headVersion: '1.0.1', changedPaths: ['README.md'],
  });
  assert.equal(r.ok, true);
  assert.match(r.reason, /harmless/);
});

test('an action.yml change without a bump fails', () => {
  const r = evaluateVersionBump({
    baseVersion: '2.3.4', headVersion: '2.3.4', changedPaths: ['action.yml'],
  });
  assert.equal(r.ok, false);
  assert.match(r.reason, /action\.yml changed/);
});

test('a major bump alongside a src change passes', () => {
  const r = evaluateVersionBump({
    baseVersion: '1.4.2', headVersion: '2.0.0', changedPaths: ['src/index.js'],
  });
  assert.equal(r.ok, true);
});

test('a version decrease fails regardless of what changed', () => {
  const r = evaluateVersionBump({
    baseVersion: '1.2.0', headVersion: '1.1.0', changedPaths: ['README.md'],
  });
  assert.equal(r.ok, false);
  assert.match(r.reason, /clean single-step increase/);
});

test('an empty changeset needs no bump', () => {
  const r = evaluateVersionBump({ baseVersion: '1.0.0', headVersion: '1.0.0', changedPaths: [] });
  assert.equal(r.ok, true);
});

test('a prerelease version fails with a readable reason rather than throwing', () => {
  const r = evaluateVersionBump({
    baseVersion: '1.0.0', headVersion: '1.1.0-rc.1', changedPaths: ['src/index.js'],
  });
  assert.equal(r.ok, false);
  assert.match(r.reason, /Not a plain X\.Y\.Z version/);
});
