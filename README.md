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
      - uses: actions/checkout@v4
      - uses: jasonworden/mermaid-lint-action@v1
        with:
          files: 'docs/**/*.md **/*.mmd'
          strict: true
```

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `files` | No | *(git-tracked *.md / *.mmd / *.mdx)* | Space-separated glob patterns to validate |
| `strict` | No | `false` | Treat semantic warnings as errors (exit 1) |
| `working-directory` | No | `.` | Directory to run mermaid-lint from |

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

With `strict: true`, semantic warnings (e.g. duplicate node IDs) are also annotated.

## Requirements

Requires Node.js 24 (provided by the GitHub-hosted runners).
