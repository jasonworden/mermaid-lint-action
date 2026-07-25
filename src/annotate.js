'use strict';

/**
 * Resolves an in-diagram offset to a line number in the source file.
 *
 * `fenceLine` is the line of the opening ``` fence and `offset` is the position
 * within the diagram body. `adjust` absorbs the difference in how the CLI counts
 * that offset; prefer the two named wrappers below over calling this directly.
 *
 * When `offset` is absent we can't do better than the fence itself; guessing one
 * line in would put the annotation on the wrong statement.
 *
 * @param {number} fenceLine
 * @param {number|undefined|null} offset
 * @param {number} adjust - added to close the gap between the offset's base and 1
 * @returns {number} 1-based line number in the file
 */
function resolveLine(fenceLine, offset, adjust) {
  const line = offset == null ? fenceLine : fenceLine + offset + adjust;
  return Math.max(1, line);
}

/** `error.line` counts from 0 within the diagram body, so it needs one more. */
const errorLine = (fenceLine, offset) => resolveLine(fenceLine, offset, 1);

/** `warning.line` already counts from 1, so the fence line is the only offset. */
const warningLine = (fenceLine, offset) => resolveLine(fenceLine, offset, 0);

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
          startLine: errorLine(diagram.line, diagram.error?.line),
        });
      }
      for (const w of diagram.warnings ?? []) {
        warnings.push({
          message: `${w.rule}: ${w.message}`,
          file: file.path,
          startLine: warningLine(diagram.line, w.line),
        });
      }
    }
  }
  return { errors, warnings };
}

module.exports = { buildAnnotations };
