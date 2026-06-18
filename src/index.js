'use strict';
const core = require('@actions/core');
const exec = require('@actions/exec');
const { buildAnnotations } = require('./annotate.js');

async function run() {
  const filesInput = core.getInput('files').trim();
  const strict = core.getBooleanInput('strict');
  const workingDir = core.getInput('working-directory').trim() || '.';

  const args = ['--yes', '@mermaid-lint/cli', '--format', 'json'];
  if (strict) args.push('--strict');
  if (filesInput) {
    args.push(...filesInput.split(/\s+/).filter(Boolean));
  }

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
  } catch (e) {
    core.setFailed(`mermaid-lint produced unexpected output.\nstdout: ${stdout}\nstderr: ${stderr}`);
    return;
  }

  const { errors, warnings } = buildAnnotations(results, strict);
  for (const err of errors) {
    core.error(err.message, { file: err.file, startLine: err.startLine });
  }
  for (const w of warnings) {
    core.warning(w.message, { file: w.file, startLine: w.startLine });
  }

  core.setOutput('diagrams', String(results.summary.diagrams));
  core.setOutput('errors', String(results.summary.errors));
  core.setOutput('warnings', String(results.summary.warnings));

  const { diagrams, errors: errCount, warnings: warnCount, files } = results.summary;
  const msg = `Checked ${diagrams} diagram(s) in ${files} file(s) — ${errCount} error(s), ${warnCount} warning(s)`;

  if (exitCode !== 0) {
    core.setFailed(msg);
  } else {
    core.info(`✓ ${msg}`);
  }
}

run().catch(core.setFailed);
