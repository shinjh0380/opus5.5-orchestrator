# Cache Lab live pilot, September 7, 2026

This is a small end-to-end demonstration, not a general model benchmark. Declare the protocol before making the calls.

- Same seed CONTRACT.md, calculator.test.mjs, goal and output files.
- Team: Astra low planner, up to two Luna medium workers, Astra low reviewer.
- Solo comparison: one Astra low implementer, same Astra low independent reviewer; no planner call.
- Same external tests, one repair round, 240-second per-call timeout, at most eight calls, admission stops after 250K observed input+output tokens.
- Team runs first, solo second; one sample each. Cache state is uncontrolled and sequential order can advantage the later run. No cache clearing or randomized repeats are performed. Report the observed cache tokens and do not attribute a difference solely to models.
- Compare acceptance, tests, observed token usage, elapsed model-call time and Standard API-equivalent cost. Runtime tools, subscription allowances and API charges are different quantities.
- Do not reuse outputs between arms or let an implementer see the other result. Both reviewers see only their candidate, common contract and actual checks.
- JSONL usage is summed across turn.completed events. Reasoning output is a subset of output, never added twice. When cache writes are absent report a range. Above 272K aggregate input, refuse a precise estimate without request-level context lengths.
- CLI model arguments are pinned; the current JSONL does not separately attest the backend model. No claim of backend attestation.
- Private JSONL, prompts, account tokens and diagnostics are excluded from published evidence. Publish the explicitly allowlisted receipts, plans, reviews, generated example and test outputs after checking contents.
- Failure is an outcome. A failed arm must not be compared as equally complete work.
