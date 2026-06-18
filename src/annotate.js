'use strict';

/**
 * Converts mermaid-lint JSON output into GitHub Actions annotation objects.
 *
 * @param {object} results - Parsed JSON from `mermaid-lint --format json`
 * @param {boolean} strict - When true, warnings are also emitted as annotation objects
 * @returns {{ errors: Array<{message: string, file: string, startLine: number}>,
 *             warnings: Array<{message: string, file: string, startLine: number}> }}
 */
function buildAnnotations(results, strict) {
  const errors = [];
  const warnings = [];
  for (const file of results.files) {
    for (const diagram of file.diagrams) {
      if (!diagram.ok) {
        errors.push({
          message: diagram.error?.message ?? 'parse error',
          file: file.path,
          startLine: Math.max(1, diagram.line + (diagram.error?.line ?? 0)),
        });
      }
      if (strict) {
        for (const w of diagram.warnings ?? []) {
          warnings.push({
            message: `${w.rule}: ${w.message}`,
            file: file.path,
            startLine: Math.max(1, diagram.line + (w.line ?? 0)),
          });
        }
      }
    }
  }
  return { errors, warnings };
}

module.exports = { buildAnnotations };
