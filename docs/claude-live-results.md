# Live CLI runs: Claude Opus 5.5 / Sonnet 5.5 on Cache Lab

Date: November 2, 2026. Linux, Claude Code 2.1.316, Node.js 22.23.4. The [protocol](experiment-protocol.md) matches the September 7 Astra/Luna pilot: same seed `CONTRACT.md` and `calculator.test.mjs`, same goal and outputs, same 11 checks, `maxCalls` 8, `maxRepairs` 1, `stopAfterTokens` 250K, 240 s per call. Team ran first, then solo. Cache state was not controlled. Only the models, efforts, provider/CLI and the new optional escalation lane differ (see [migration notes](migration-claude.md)).

Two pairs were run. Pair 1 used Claude Code's default prompt caching. Pair 2 used the shipped default, `promptCaching: "off"`, and is the primary result.

## Primary result (pair 2, `promptCaching: off`)

| Measure | Team: Opus plan → Sonnet ×2 → Opus review | Solo: Opus implement → Opus review | Historical team (Astra/Luna) | Historical solo (Astra) |
|---|---:|---:|---:|---:|
| Accepted | yes | yes | yes | yes |
| Model calls | 7 (plan, 2 workers, review **fix**, 2 repairs, review accept) | 2 | 4 | 2 |
| Calls by model | Opus 3, Sonnet 4 | Opus 2 | Astra 2, Luna 2 | Astra 2 |
| Input / output tokens | 150,511 / 21,314 | 47,220 / 15,532 | 77,697 / 7,032 | 43,433 / 4,747 |
| Thinking (within output) | 2,049 | 2,209 | 450 reasoning | 40 reasoning |
| Checks (11 tests) | 11/11 in both rounds | 11/11 | 11/11 | 11/11 |
| Browser acceptance probe (8 items, below) | 8/8 | 8/8 | 8/8 | 8/8 |
| Wall time | 158.9 s | 143.6 s | 140.8 s | 156.8 s |
| API list-price equivalent | **$0.7088** | **$0.4995** | $0.5205 | $0.6717 |
| Change vs. historical | +36.2% cost, +12.8% time | −25.6% cost, −8.4% time | — | — |
| Escalations | 0 | n/a | n/a | n/a |

The Claude Code CLI also made small Haiku 5.5 calls of its own on every request: $0.0062 (team) and $0.0022 (solo), recorded as `auxiliary` and excluded from the figures above. The CLI's own client-side cost totals agree with our list-price estimates to within those auxiliary amounts.

**What happened in the team arm.** In both team runs the Opus reviewer returned `fix` on the first candidate. The Sonnet-built `index.html` read blank number fields as 0 and showed a valid-looking total, although the plan's contract said to reject empty fields. One Sonnet repair round fixed it, and the second review accepted. The historical Astra review accepted Luna's first candidate. So the review gate behaved as designed, but Sonnet at medium missed one explicit UI requirement on its first pass both times. That is the main reason the team arm needed 7 calls instead of 4.

**What changed economically.** Opus costs only 2× Sonnet (Astra cost 50× Luna), so routing implementation to the cheaper model no longer offsets the extra planning, review and repair tokens. In this sample, team was **41.9% more expensive than solo**, where the historical team was 22.5% cheaper. Both orchestration modes were preserved. This sample suggests solo is the cheaper choice for a small two-file task like Cache Lab.

## Prompt caching (pair 1 vs pair 2)

| | Team, CLI default caching | Team, caching off | Solo, CLI default | Solo, off |
|---|---:|---:|---:|---:|
| Cache writes / reads | 112,350 / 38,487 | 0 / 0 | 34,665 / 12,865 | 0 / 0 |
| Cost | $0.9679 | $0.7088 | $0.5786 | $0.4995 |
| Outcome | accepted, 7 calls, same fix → repair pattern | accepted, 7 calls | accepted | accepted |

With caching on, Claude Code writes each prompt to the 1-hour cache at 2× the input price, while one-shot role prompts are rarely reused. Turning caching off reduced cost by 26.8% (team) and 13.7% (solo) with the same outcomes, so `off` is the default. Jobs can opt back in with `promptCaching: "cli-default"`.

## Quality comparison with identical criteria

The 11 contract tests, plus the same Playwright probe, were run on every accepted candidate: the historical `examples/published/{team,solo}` and the new `examples/published-claude/*`. The probe checks:

1. Initial total $0.38 (Astra warm preset).
2. Switching to Luna gives $0.008.
3. Cold preset gives $1.35.
4. A blank field shows an error and no total.
5. Overlapping counts show an error and clear the total.
6. Valid input recovers.
7. No horizontal overflow at 390 px.
8. No horizontal overflow at 1280 px.

All six candidates scored 11/11 and 8/8 with no page errors. These criteria do not measure visual quality or code style.

## Native mode

One headless native run (Opus primary → Sonnet `astra-worker` → Opus `astra-review` → repair → fresh review) on the CSV smoke contract is recorded in [native-validation.md](native-validation.md). Its token figures come from the host and are a different accounting scope from the CLI receipts above.

## Limits of this evidence

- Two samples per arm in total, one per caching setting. Order was not randomized and cache state was not controlled. This is not a benchmark.
- Historical runs used another provider, CLI, models and dated prices. Cost and time differences combine all of these, not models alone.
- "Same quality" here means the same pass rate on 11 unit tests and 8 behavioural checks. A larger task suite is needed before claiming equal general quality.
- Model labels are the pinned `--model` argument plus the CLI's per-model usage key. They are not independent backend attestation.

## Evidence

- [Comparison JSON](../examples/published-claude/comparison.json), including the historical totals
- Receipts, plans, reviews and generated files: [team](../examples/published-claude/team/), [solo](../examples/published-claude/solo/), [team, cache on](../examples/published-claude/team-cache-on/), [solo, cache on](../examples/published-claude/solo-cache-on/)
- Prices: [Claude API pricing](https://platform.claude.com/docs/en/about-claude/pricing), accessed 2026-11-02. Standard list prices, no batch discount, not subscription billing.
