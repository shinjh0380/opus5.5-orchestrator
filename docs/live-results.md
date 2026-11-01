# Live CLI pilot: one Cache Lab run per route

> **Historical record (v0.2.0, Codex + GPT-6 Astra / GPT-5.6 Luna).** Kept unchanged for comparison. The current Claude Opus 5.5 / Sonnet 5.5 configuration and its results are in [claude-live-results.md](claude-live-results.md) and [migration-claude.md](migration-claude.md).

On September 7, 2026, macOS with Codex CLI 0.153.4, we ran the same contract, tests, and output requirements under the [predefined protocol](experiment-protocol.md). The team ran first, then solo. Cache state was not controlled. These are **CLI results**, not measurements of the native plugin or skill.

| Measure | Astra planning + Luna implementation + Astra review | Astra implementation + Astra review |
|---|---:|---:|
| Model calls | 4 | 2 |
| Input tokens | 77,697 | 43,433 |
| Output tokens, including reasoning | 7,032 | 4,747 |
| Cached input | 0 | 0 |
| Actual checks | 11/11 passed | 11/11 passed |
| Independent review | accept | accept |
| Total elapsed time | 140.838 seconds | 156.849 seconds |
| Standard API equivalent | $0.5204534 | $0.6716800 |

In this pair, **total processed tokens increased 75.9%, while API-equivalent cost fell 22.5%**. Implementation work moved to the cheaper Luna model; input and output prices also differ. Recorded cache hits were zero, so this is not a cache-savings example.

This is one observation per route for a small web tool. The two implementations differ in code and appearance but pass the same contract and functional checks. Without randomized order, repeated trials, and controlled cache state, these observations do not establish general savings, model superiority, or a reliable speed improvement. More workers or repeated Astra context can increase cost.

## Failed attempts also cost money

Two development trials failed before the completed comparison:

1. The planner returned an instruction where the context array required a filename; validation stopped the run: $0.25310 equivalent.
2. A shared object reference in schema construction accidentally restricted prose fields as well as file output; the reference was separated and a regression test added: $0.19923 equivalent.

The combined **$0.45233** is separate from the completed runs above. Both [failure one](../examples/published/development-failure-01/receipt.json) and [failure two](../examples/published/development-failure-02/receipt.json) receipts are public. Adding those trials to the team run gives **$0.9727834**. Initial tool development, connection checks, video production, and documentation work are outside these figures; they are not total production cost.

## Inspect the evidence

- [Machine-readable comparison](../examples/published/comparison.json)
- [Team receipt](../examples/published/team/receipt.json) and [generated code](../examples/published/team/calculator.mjs)
- [Solo receipt](../examples/published/solo/receipt.json) and [generated code](../examples/published/solo/calculator.mjs)
- [Team task contract](../examples/published/team/plan.json)
- [Team review](../examples/published/team/review-0.json) and [solo review](../examples/published/solo/review-0.json)

```sh
cd examples/published/team
node --test calculator.test.mjs
python3 -m http.server 8791 --bind 127.0.0.1
```

The original generated code, Korean demo UI, contracts, and receipt data are retained as evidence. English report labels are a presentation change, not a new model run.

Costs use the September 7, 2026 short-context Standard rates from [official API pricing](https://developers.openai.com/api/docs/pricing), with recorded input, cached-read, cached-write, and output fields. Total input across all calls remained below 272K; recorded cache writes were also zero. These are not subscription charges, tool fees, or taxes. Model labels record pinned CLI request arguments, not independent verification of the service's internal backend.
