# Invalid fixture

Do not fix the diagram below. CI lints this file on purpose and asserts that
the action fails and annotates line 12 — `->` is not a valid flowchart link,
which needs `-->`. That line number is asserted in CI, so adding or removing
lines above the diagram means updating `.github/workflows/ci.yml` too.

```mermaid
flowchart TD
    A[Start] --> B[Middle]
    B --> C[Next]
    C -> D[Broken]
    D --> E[End]
```
