# Invalid fixture

Do not fix the diagram below — it is broken on purpose. `->` is not a valid
flowchart link, which needs `-->`. CI expects this file to produce exactly one
error in one diagram, annotated on the `C -> D[Broken]` line.

The integration test finds that line by searching for its text, so moving the
diagram around within this file is fine.

```mermaid
flowchart TD
    A[Start] --> B[Middle]
    B --> C[Next]
    C -> D[Broken]
    D --> E[End]
```
