'use strict';

/**
 * Resolves an in-diagram offset to a line number in the source file.
 *
 * `fenceLine` is the line of the opening ``` fence. `offset` is the position
 * within the diagram body, and `base` says what that offset counts from — the
 * CLI is not consistent about this, so callers have to tell us which they have.
 *
 * When `offset` is absent we can't do better than the fence itself; guessing
 * one line in would put the annotation on the wrong statement.
 *
 * @param {number} fenceLine
 * @param {number|undefined|null} offset
 * @param {0|1} base - 0 if `offset` is 0-indexed, 1 if 1-indexed
 * @returns {number} 1-based line number in the file
 */
function resolveLine(fenceLine, offset, base) {
  const line = offset == null ? fenceLine : fenceLine + offset + (1 - base);
  return Math.max(1, line);
}

/**
 * Converts mermaid-lint JSON output into GitHub Actions annotation objects.
 *
 * Note the asymmetry in the CLI's output, verified against
 * `@mermaid-lint/cli@0.35.1`: `error.line` is 0-indexed within the diagram
 * body while `warning.line` is 1-indexed. See test/annotate.test.js.
 *
 * Warnings are always returned. A rule whose severity is "error" (duplicate-ids
 * is one) makes the CLI exit non-zero with or without `--strict`, so suppressing
 * warning annotations would produce a failed job with nothing pointing at why.
 *
 * @param {object} results - Parsed JSON from `mermaid-lint --format json`
 * @returns {{ errors: Array<{message: string, file: string, startLine: number}>,
 *             warnings: Array<{message: string, file: string, startLine: number}> }}
 */
function buildAnnotations(results) {
  const errors = [];
  const warnings = [];
  for (const file of results.files ?? []) {
    for (const diagram of file.diagrams ?? []) {
      if (!diagram.ok) {
        errors.push({
          message: diagram.error?.message ?? 'parse error',
          file: file.path,
          startLine: resolveLine(diagram.line, diagram.error?.line, 0),
        });
      }
      for (const w of diagram.warnings ?? []) {
        warnings.push({
          message: `${w.rule}: ${w.message}`,
          file: file.path,
          startLine: resolveLine(diagram.line, w.line, 1),
        });
      }
    }
  }
  return { errors, warnings };
}

module.exports = { buildAnnotations };
