'use strict';
const core = require('@actions/core');
const exec = require('@actions/exec');
const { buildAnnotations } = require('./annotate.js');
const { buildNpxArgs, readSummary, formatSummary } = require('./cli.js');

async function run() {
  // No trim: buildNpxArgs splits on whitespace and drops empties.
  const files = core.getInput('files');
  const strict = core.getBooleanInput('strict');
  const version = core.getInput('version').trim();
  const workingDir = core.getInput('working-directory').trim() || '.';

  const args = buildNpxArgs({ files, strict, version });

  let stdout = '';
  let stderr = '';
  const exitCode = await exec.exec('npx', args, {
    cwd: workingDir,
    ignoreReturnCode: true,
    silent: true,
    listeners: {
      stdout: (data) => { stdout += data.toString(); },
      stderr: (data) => { stderr += data.toString(); },
    },
  });

  let results;
  try {
    results = JSON.parse(stdout);
  } catch {
    core.setFailed(`mermaid-lint produced unexpected output.\nstdout: ${stdout}\nstderr: ${stderr}`);
    return;
  }

  const { errors, warnings } = buildAnnotations(results);
  for (const err of errors) {
    core.error(err.message, { file: err.file, startLine: err.startLine });
  }
  for (const w of warnings) {
    core.warning(w.message, { file: w.file, startLine: w.startLine });
  }

  const summary = readSummary(results);
  core.setOutput('diagrams', String(summary.diagrams));
  core.setOutput('errors', String(summary.errors));
  core.setOutput('warnings', String(summary.warnings));

  const msg = formatSummary(summary);
  if (exitCode !== 0) {
    core.setFailed(msg);
  } else {
    core.info(`✓ ${msg}`);
  }
}

run().catch(core.setFailed);
