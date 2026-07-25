#!/usr/bin/env node
'use strict';

/**
 * Fails if the committed bundle differs from a fresh build of src/.
 *
 * GitHub runs dist/index.js directly rather than installing dependencies, so a
 * stale bundle ships source changes that silently never take effect. Run via
 * `npm run verify-dist`, which builds first.
 *
 * Uses `git status --porcelain` rather than `git diff` so that a newly emitted
 * bundle file counts as drift too — `git diff` alone would not see an untracked
 * one.
 */

const { execFileSync } = require('node:child_process');
const { resolve } = require('node:path');

const root = resolve(__dirname, '..');

function git(args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf-8' });
}

const status = git(['status', '--porcelain', '--', 'dist/']).trim();

if (!status) {
  console.log('dist/ is in sync with src/');
  process.exit(0);
}

console.error("::error::dist/ is out of date. Run 'npm run build' and commit the result.");
console.error(status);
console.error(git(['diff', '--', 'dist/']).split('\n').slice(0, 100).join('\n'));
process.exit(1);
