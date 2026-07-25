#!/usr/bin/env node
'use strict';

/**
 * PR-time version bump check.
 *
 * release.yml tags whatever version lands on `main`, so a PR that changes the
 * action without bumping package.json ships nothing and nobody notices. This
 * asserts the two stay in step.
 *
 * The requirement is derived from the changed paths rather than from a label:
 * touching what actually gets published (src/, dist/, action.yml) requires a
 * bump; a docs- or CI-only PR does not.
 *
 * Run: node scripts/check-version-bump.js
 * Exits 0 (PASS) or 1 (FAIL) with a human-readable reason.
 */

const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const root = resolve(__dirname, '..');

/**
 * Paths that do NOT reach consumers, so changing them alone needs no bump.
 *
 * Deliberately an exempt-list rather than a list of released paths: a new
 * released path (a second entrypoint, a bin/, a template dir) then requires a
 * bump by default. The allowlist version of this fails open — you would get no
 * release and no warning, and find out when someone reports @v1 never picked
 * up the fix.
 */
const EXEMPT_PATHS = [
  /^README\.md$/,
  /^LICENSE$/,
  /^\.gitignore$/,
  /^\.gitattributes$/,
  /^\.npmrc$/,
  /^\.github\//,
  /^test\//,
  /^scripts\//,
];

/**
 * @param {string} str
 * @returns {[number, number, number]}
 */
function parseVersion(str) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(str ?? '');
  if (!match) {
    throw new Error(`Not a plain X.Y.Z version: ${JSON.stringify(str)}`);
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/**
 * Classifies the change between two versions.
 *
 * Anything that is not a clean single-component increase is `invalid` — that
 * includes decreases and skipped versions (1.0.0 -> 1.0.2), because both are
 * nearly always a hand-edit slip, and this number decides what gets tagged.
 *
 * @param {[number, number, number]} base
 * @param {[number, number, number]} head
 * @returns {'none'|'major'|'minor'|'patch'|'invalid'}
 */
function diffLevel(base, head) {
  const [bMajor, bMinor, bPatch] = base;
  const [hMajor, hMinor, hPatch] = head;
  if (bMajor === hMajor && bMinor === hMinor && bPatch === hPatch) return 'none';
  if (hMajor === bMajor + 1 && hMinor === 0 && hPatch === 0) return 'major';
  if (hMajor === bMajor && hMinor === bMinor + 1 && hPatch === 0) return 'minor';
  if (hMajor === bMajor && hMinor === bMinor && hPatch === bPatch + 1) return 'patch';
  return 'invalid';
}

/**
 * @param {string[]} changedPaths - repo-relative, as `git diff --name-only` prints them
 * @returns {string[]} the subset that reaches consumers
 */
function releaseAffectingPaths(changedPaths) {
  return changedPaths.filter((p) => !EXEMPT_PATHS.some((re) => re.test(p)));
}

/**
 * @param {{baseVersion: string, headVersion: string, changedPaths: string[]}} input
 * @returns {{ok: boolean, reason: string}}
 */
function evaluateVersionBump({ baseVersion, headVersion, changedPaths }) {
  let level;
  try {
    level = diffLevel(parseVersion(baseVersion), parseVersion(headVersion));
  } catch (err) {
    // Returned rather than thrown so the caller still prints a readable FAIL:
    // a prerelease like 1.2.0-rc.1 is a policy violation, not a crash.
    return { ok: false, reason: err.message };
  }
  const affecting = releaseAffectingPaths(changedPaths);

  if (level === 'invalid') {
    return {
      ok: false,
      reason: `version went from ${baseVersion} to ${headVersion}, which isn't a clean single-step increase.`,
    };
  }

  if (affecting.length === 0) {
    return {
      ok: true,
      reason: level === 'none'
        ? 'no released files changed and no bump was made.'
        : `no released files changed; the ${level} bump to ${headVersion} is harmless.`,
    };
  }

  if (level === 'none') {
    return {
      ok: false,
      reason: `${affecting.join(', ')} changed but package.json is still ${baseVersion}. `
        + 'Bump it, or the merge will not produce a release.',
    };
  }

  return { ok: true, reason: `${level} bump to ${headVersion} accompanies changes to ${affecting.join(', ')}.` };
}

function git(args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf-8' }).trim();
}

function getBaseVersion() {
  try {
    // Already present after a full checkout, so CI skips the network entirely;
    // this fetch exists for local runs.
    git(['rev-parse', '--verify', '--quiet', 'origin/main']);
  } catch {
    try {
      git(['fetch', 'origin', 'main', '--quiet']);
    } catch {
      // Fall through — the read below produces the actionable error.
    }
  }
  try {
    return JSON.parse(git(['show', 'origin/main:package.json'])).version;
  } catch {
    throw new Error('Could not read package.json from origin/main. Run `git fetch origin main` and retry.');
  }
}

function getHeadVersion() {
  return JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf-8')).version;
}

function getChangedPaths() {
  return git(['diff', '--name-only', 'origin/main...HEAD']).split('\n').filter(Boolean);
}

function main() {
  const baseVersion = getBaseVersion();
  const headVersion = getHeadVersion();
  const changedPaths = getChangedPaths();

  console.log(`Base version (origin/main): ${baseVersion}`);
  console.log(`Head version:               ${headVersion}`);
  console.log(`Changed files:              ${changedPaths.length}`);

  const result = evaluateVersionBump({ baseVersion, headVersion, changedPaths });

  if (result.ok) {
    console.log(`PASS: ${result.reason}`);
    process.exit(0);
  }
  console.error(`FAIL: ${result.reason}`);
  process.exit(1);
}

module.exports = { parseVersion, diffLevel, releaseAffectingPaths, evaluateVersionBump };

if (require.main === module) {
  main();
}
