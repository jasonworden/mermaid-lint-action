'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildAnnotations } = require('../src/annotate.js');

const clean = {
  files: [
    {
      path: 'docs/api.md',
      diagrams: [{ line: 10, col: 1, type: 'flowchart', ok: true, warnings: [] }],
    },
  ],
  summary: { files: 1, diagrams: 1, ok: 1, errors: 0, warnings: 0, types: {} },
};

const withError = {
  files: [
    {
      path: 'docs/api.md',
      diagrams: [
        {
          line: 10,
          col: 1,
          type: 'flowchart',
          ok: false,
          error: { message: 'Expecting SPACE', line: 3, col: 5 },
          warnings: [],
        },
      ],
    },
  ],
  summary: { files: 1, diagrams: 1, ok: 0, errors: 1, warnings: 0, types: {} },
};

const withWarning = {
  files: [
    {
      path: 'docs/api.md',
      diagrams: [
        {
          line: 10,
          col: 1,
          type: 'flowchart',
          ok: true,
          warnings: [{ rule: 'duplicate-ids', message: 'node "A" declared twice', line: 4 }],
        },
      ],
    },
  ],
  summary: { files: 1, diagrams: 1, ok: 1, errors: 0, warnings: 1, types: {} },
};

test('clean result produces no annotations', () => {
  const { errors, warnings } = buildAnnotations(clean, false);
  assert.equal(errors.length, 0);
  assert.equal(warnings.length, 0);
});

test('error produces correct annotation with file and line', () => {
  const { errors } = buildAnnotations(withError, false);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].message, 'Expecting SPACE');
  assert.equal(errors[0].file, 'docs/api.md');
  // startLine = diagram.line (10) + error.line (3) = 13
  assert.equal(errors[0].startLine, 13);
});

test('warning not emitted when strict=false', () => {
  const { warnings } = buildAnnotations(withWarning, false);
  assert.equal(warnings.length, 0);
});

test('warning emitted as warning annotation when strict=true', () => {
  const { warnings } = buildAnnotations(withWarning, true);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].message, 'duplicate-ids: node "A" declared twice');
  assert.equal(warnings[0].file, 'docs/api.md');
  // startLine = diagram.line (10) + warning.line (4) = 14
  assert.equal(warnings[0].startLine, 14);
});

test('error.line missing defaults startLine to diagram.line', () => {
  const noErrorLine = {
    files: [{
      path: 'a.md',
      diagrams: [{ line: 5, col: 1, type: 'flowchart', ok: false, error: { message: 'bad' }, warnings: [] }],
    }],
    summary: { files: 1, diagrams: 1, ok: 0, errors: 1, warnings: 0, types: {} },
  };
  const { errors } = buildAnnotations(noErrorLine, false);
  assert.equal(errors[0].startLine, 5);
});

test('startLine is at least 1 even when diagram.line is 0', () => {
  const zeroLine = {
    files: [{
      path: 'a.md',
      diagrams: [{ line: 0, col: 0, type: 'unknown', ok: false, error: { message: 'cannot read file: ENOENT' }, warnings: [] }],
    }],
    summary: { files: 1, diagrams: 1, ok: 0, errors: 1, warnings: 0, types: {} },
  };
  const { errors } = buildAnnotations(zeroLine, false);
  assert.equal(errors[0].startLine, 1);
});

test('multiple files and diagrams all annotated', () => {
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
        diagrams: [
          { line: 2, ok: false, error: { message: 'err2', line: 1 }, warnings: [] },
        ],
      },
    ],
    summary: {},
  };
  const { errors } = buildAnnotations(multi, false);
  assert.equal(errors.length, 2);
  assert.equal(errors[0].file, 'a.md');
  assert.equal(errors[1].file, 'b.md');
  assert.equal(errors[1].startLine, 3); // 2 + 1
});
