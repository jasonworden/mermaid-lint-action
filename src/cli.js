'use strict';

const CLI_PACKAGE = '@mermaid-lint/cli';

/**
 * Builds the argv handed to `npx`.
 *
 * `version` is pinned by default (see action.yml) so that a floating action ref
 * like `@v1` resolves to a predictable CLI. Passing an empty string opts back
 * into "whatever npm says is latest".
 *
 * @param {{files?: string, strict?: boolean, version?: string}} opts
 * @returns {string[]}
 */
function buildNpxArgs({ files = '', strict = false, version = '' } = {}) {
  const spec = version ? `${CLI_PACKAGE}@${version}` : CLI_PACKAGE;
  const args = ['--yes', spec, '--format', 'json'];
  if (strict) args.push('--strict');
  args.push(...files.split(/\s+/).filter(Boolean));
  return args;
}

/**
 * Reads the `summary` block defensively — a CLI that bailed early can emit
 * valid JSON with no summary, and reporting zeros beats throwing.
 *
 * @param {object} results
 * @returns {{files: number, diagrams: number, errors: number, warnings: number}}
 */
function readSummary(results) {
  const s = results.summary ?? {};
  return {
    files: s.files ?? 0,
    diagrams: s.diagrams ?? 0,
    errors: s.errors ?? 0,
    warnings: s.warnings ?? 0,
  };
}

/**
 * @param {{files: number, diagrams: number, errors: number, warnings: number}} summary
 * @returns {string}
 */
function formatSummary(summary) {
  return `Checked ${summary.diagrams} diagram(s) in ${summary.files} file(s) — `
    + `${summary.errors} error(s), ${summary.warnings} warning(s)`;
}

module.exports = { CLI_PACKAGE, buildNpxArgs, readSummary, formatSummary };
