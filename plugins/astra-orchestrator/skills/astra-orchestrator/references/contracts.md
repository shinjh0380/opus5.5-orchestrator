# Task and result examples

Adapt the packet to the task. Exact ownership and acceptance conditions matter more than a fixed output format.

## Worker packet

```text
Goal: Add a CSV export for the existing filtered transaction list.
Project: /absolute/path/to/project
Owned files: src/export/csv.ts, src/export/csv.test.ts
Interface: exportTransactions(rows) returns UTF-8 CSV with a header row.
Context: Read src/types/transaction.ts and the existing export tests.
Acceptance: Escape commas, quotes and newlines; keep row order; empty rows produce only the header. Run the targeted test command.
You share this project with others. Preserve their edits and stay within your files. Report a dependency if the agreed interface is insufficient.
Return: changed paths, checks actually run and outcomes, unresolved assumptions.
```

## Reviewer packet

```text
Review this completed change independently. Do not edit files.
Read the goal, relevant source and actual diff; verify the reported checks against the artifacts.
Return accept, fix, or blocked. For each fix, identify the path, reachable failure, and a concrete correction.
Do not repeat the implementation merely to prove agreement.
```

## Execution record

```json
{
  "mode": "native",
  "route": "delegate-and-review",
  "rootModel": "unverified",
  "workers": [{"role": "astra_luna_worker", "requestedModel": "gpt-5.6-luna", "effort": "medium", "ownedFiles": ["src/export/csv.ts"]}],
  "checks": [{"command": "the actual check command", "result": "passed"}],
  "review": "accept",
  "usage": "unavailable"
}
```

The record describes observed work. Fill it from the run; examples are not evidence. Use the host's exposed model field only when available, and separate it from requested configuration.
