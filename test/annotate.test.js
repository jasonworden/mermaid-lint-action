'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildAnnotations } = require('../src/annotate.js');

// ---------------------------------------------------------------------------
// Line-number conventions, captured from real `@mermaid-lint/cli@0.35.1` output.
//
// The CLI reports two different offsets and they do NOT agree:
//
//   error.line    0-indexed within the diagram body
//   warning.line  1-indexed within the diagram body
//
// `diagram.line` is the line of the opening ``` fence in both cases, so:
//
//   error   -> file line = diagram.line + error.line + 1
//   warning -> file line = diagram.line + warning.line
//
// The fixtures below are verbatim CLI payloads; the expected line numbers were
// read off the source files by hand. Don't "simplify" the two formulas into
// one — they really are different.
// ---------------------------------------------------------------------------

// From test/fixtures/invalid.md — the `->` typo sits on file line 9.
const realError = {
  version: '0.35.1',
  files: [
    {
      path: 'deep.md',
      diagrams: [
        {
          line: 5,
          col: 1,
          type: 'flowchart',
          ok: false,
          warnings: [],
          error: { message: "Expecting 'LINK', got 'MINUS'", line: 3, col: 6 },
        },
      ],
    },
  ],
  summary: { files: 1, diagrams: 1, ok: 0, errors: 1, warnings: 0, types: { flowchart: 1 } },
};

// From test/fixtures/warning.md — the duplicate `A[...]` sits on file line 7.
const realWarning = {
  version: '0.35.1',
  files: [
    {
      path: 'warn.md',
      diagrams: [
        {
          line: 4,
          col: 1,
          type: 'flowchart',
          ok: true,
          warnings: [
            {
              rule: 'duplicate-ids',
              severity: 'error',
              message: 'node "A" declared with label "First" (line 2) and "Duplicate Label" (line 3)',
              line: 3,
            },
          ],
        },
      ],
    },
  ],
  summary: { files: 1, diagrams: 1, ok: 1, errors: 0, warnings: 1, types: { flowchart: 1 } },
};

const clean = {
  files: [
    {
      path: 'docs/api.md',
      diagrams: [{ line: 10, col: 1, type: 'flowchart', ok: true, warnings: [] }],
    },
  ],
  summary: { files: 1, diagrams: 1, ok: 1, errors: 0, warnings: 0, types: {} },
};

test('clean result produces no annotations', () => {
  const { errors, warnings } = buildAnnotations(clean);
  assert.equal(errors.length, 0);
  assert.equal(warnings.length, 0);
});

test('error annotation lands on the real source line (0-indexed error.line)', () => {
  const { errors } = buildAnnotations(realError);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].file, 'deep.md');
  // fence at 5, error.line 3 is 0-indexed within the body -> file line 9
  assert.equal(errors[0].startLine, 9);
});

test('warning annotation lands on the real source line (1-indexed warning.line)', () => {
  const { warnings } = buildAnnotations(realWarning);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].file, 'warn.md');
  assert.match(warnings[0].message, /^duplicate-ids: /);
  // fence at 4, warning.line 3 is 1-indexed within the body -> file line 7
  assert.equal(warnings[0].startLine, 7);
});

test('warnings are annotated unconditionally, not gated on strict', () => {
  // The CLI exits non-zero for a warning whose rule severity is "error"
  // (duplicate-ids does this) with or without --strict. Gating annotations on
  // strict would leave that job failing with no inline explanation at all.
  const { warnings } = buildAnnotations(realWarning);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].startLine, 7);
});

test('error with no line falls back to the fence line, not fence+1', () => {
  const noErrorLine = {
    files: [{
      path: 'a.md',
      diagrams: [{ line: 5, col: 1, type: 'flowchart', ok: false, error: { message: 'bad' }, warnings: [] }],
    }],
    summary: {},
  };
  const { errors } = buildAnnotations(noErrorLine);
  // Offset unknown -> point at the fence rather than guessing one line in.
  assert.equal(errors[0].startLine, 5);
});

test('error.line of 0 points at the first body line', () => {
  const firstBodyLine = {
    files: [{
      path: 'a.md',
      diagrams: [{ line: 3, ok: false, error: { message: 'bad', line: 0 }, warnings: [] }],
    }],
    summary: {},
  };
  const { errors } = buildAnnotations(firstBodyLine);
  assert.equal(errors[0].startLine, 4);
});

test('missing error object still produces an annotation', () => {
  const noError = {
    files: [{ path: 'a.md', diagrams: [{ line: 7, ok: false, warnings: [] }] }],
    summary: {},
  };
  const { errors } = buildAnnotations(noError);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].message, 'parse error');
  assert.equal(errors[0].startLine, 7);
});

test('startLine is at least 1 even when diagram.line is 0', () => {
  const zeroLine = {
    files: [{
      path: 'a.md',
      diagrams: [{ line: 0, col: 0, type: 'unknown', ok: false, error: { message: 'cannot read file: ENOENT' }, warnings: [] }],
    }],
    summary: {},
  };
  const { errors } = buildAnnotations(zeroLine);
  assert.equal(errors[0].startLine, 1);
});

test('diagram with no warnings array does not throw', () => {
  const noWarnArray = {
    files: [{ path: 'a.md', diagrams: [{ line: 2, ok: true }] }],
    summary: {},
  };
  const { errors, warnings } = buildAnnotations(noWarnArray);
  assert.equal(errors.length, 0);
  assert.equal(warnings.length, 0);
});

test('file with no diagrams array does not throw', () => {
  const noDiagrams = { files: [{ path: 'empty.md' }], summary: {} };
  const { errors, warnings } = buildAnnotations(noDiagrams);
  assert.equal(errors.length, 0);
  assert.equal(warnings.length, 0);
});

test('result with no files array does not throw', () => {
  const { errors, warnings } = buildAnnotations({ summary: {} });
  assert.equal(errors.length, 0);
  assert.equal(warnings.length, 0);
});

test('multiple files and diagrams all annotated in order', () => {
  const multi = {
    files: [
      {
        path: 'a.md',
        diagrams: [
          { line: 1, ok: false, error: { message: 'err1', line: 0 }, warnings: [] },
          { line: 5, ok: true, warnings: [] },
        ],
      },
      {
        path: 'b.md',
        diagrams: [{ line: 2, ok: false, error: { message: 'err2', line: 1 }, warnings: [] }],
      },
    ],
    summary: {},
  };
  const { errors } = buildAnnotations(multi);
  assert.equal(errors.length, 2);
  assert.equal(errors[0].file, 'a.md');
  assert.equal(errors[0].startLine, 2); // 1 + 0 + 1
  assert.equal(errors[1].file, 'b.md');
  assert.equal(errors[1].startLine, 4); // 2 + 1 + 1
});

test('errors and warnings on the same diagram are both reported', () => {
  const both = {
    files: [{
      path: 'a.md',
      diagrams: [{
        line: 10,
        ok: false,
        error: { message: 'boom', line: 1 },
        warnings: [{ rule: 'r', message: 'm', line: 2 }],
      }],
    }],
    summary: {},
  };
  const { errors, warnings } = buildAnnotations(both);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].startLine, 12); // 10 + 1 + 1
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].startLine, 12); // 10 + 2
});
