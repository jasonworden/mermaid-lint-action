# mermaid-lint-action

Validate Mermaid diagrams in your CI pipeline with **inline PR annotations** — errors appear directly on the diff lines where they occur.

**[mermaid-lint →](https://github.com/jasonworden/mermaid-lint)**

## Usage

```yaml
- uses: jasonworden/mermaid-lint-action@v1
```

### Full example

```yaml
name: Lint
on: [push, pull_request]

jobs:
  mermaid:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: jasonworden/mermaid-lint-action@v1
        with:
          files: 'docs/**/*.md **/*.mmd'
          strict: true
```

## How it works

```mermaid
flowchart TD
    A[Workflow step] --> B[action.yml]
    B --> C[dist/index.js]
    C --> D[npx @mermaid-lint/cli --format json]
    D --> E{Parsed OK?}
    E -->|no| F[Report unexpected output]
    E -->|yes| G[buildAnnotations]
    G --> H[core.error / core.warning]
    G --> I[Set diagrams, errors, warnings outputs]
    H --> J{CLI exit code}
    I --> J
    J -->|zero| K[Step passes]
    J -->|non-zero| L[Step fails]
```

The action shells out to `@mermaid-lint/cli`, reads its JSON report, and
converts each finding into a GitHub annotation anchored to the right source
line. The CLI's exit code — not the annotation count — decides pass or fail.

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `files` | No | *(git-tracked *.md / *.mmd / *.mdx)* | Space-separated glob patterns to validate |
| `strict` | No | `false` | Pass `--strict`, promoting advisory warnings to failures |
| `version` | No | `^0.35.1` | npm version range for `@mermaid-lint/cli` |
| `working-directory` | No | `.` | Directory to run mermaid-lint from |

### About `version`

The CLI is pinned by default so that a floating action ref like `@v1` stays
reproducible — otherwise a new CLI release could change the outcome of a build
whose own inputs never moved. To track the latest CLI instead, pass an empty
string:

```yaml
- uses: jasonworden/mermaid-lint-action@v1
  with:
    version: ''
```

### About `strict`

`strict` maps to the CLI's `--strict` flag. It is not the only thing that can
fail a run: rules whose own severity is `error` — `duplicate-ids`, for
instance — already exit non-zero without it. Warnings are annotated either
way, so a failing run always has something pointing at its cause.

## Outputs

| Output | Description |
|---|---|
| `diagrams` | Total diagrams checked |
| `errors` | Number of diagrams with errors |
| `warnings` | Number of semantic warnings |

### Use outputs

```yaml
- uses: jasonworden/mermaid-lint-action@v1
  id: lint
- run: echo "Found ${{ steps.lint.outputs.errors }} errors"
```

## Annotations

Errors appear as inline annotations on the PR diff:

```
docs/api.md:42: error: Expecting 'SPACE', got: '->'
```

## Requirements

Requires Node.js 24 (provided by the GitHub-hosted runners).

## Development

```bash
npm ci
npm test
npm run build
```

`dist/` is a committed [ncc](https://github.com/vercel/ncc) bundle, because
GitHub runs the bundle directly rather than installing dependencies. Any change
under `src/` therefore needs `npm run build` committed alongside it; CI fails
the build if the two drift apart.

CI also runs the action against its own diagrams, including a deliberately
broken fixture it expects to fail. That is not circular — the action depends on
the `@mermaid-lint/cli` npm package, which has no dependency back on this
repository.

## Releasing

Push a semver tag. The release workflow publishes the GitHub Release and
force-moves the matching major alias, so `@v1` follows along.

```bash
git tag v1.0.1 && git push origin v1.0.1
```

## License

[MIT](LICENSE)
