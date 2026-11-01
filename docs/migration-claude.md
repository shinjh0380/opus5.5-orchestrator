# Migration: GPT-6 Astra / GPT-5.6 Luna → Claude Opus 5.5 / Sonnet 5.5

Research and validation date: **November 2, 2026**. Last Astra/Luna version: commit `f0499da` (package 0.2.0). This document records what the old configuration actually was, how each role was reassigned and why, and what evidence is still missing.

## 1. What the old names referred to

Determined from the code, not from the names:

| Name | Actual model ID | Where pinned | Price used (USD / 1M, as of 2026-09-07) |
|---|---|---|---|
| Astra | `gpt-6-astra` (OpenAI GPT-6 Astra) | `examples/cache-lab/*.json` (`planner`, `reviewer`), `agents/astra-review.toml`, skill text | input 10, cached 1, write 12.5, output 50 |
| Luna ("6 Luna") | `gpt-5.6-luna` (OpenAI GPT-5.6 Luna) | `examples/cache-lab/job.json` (`worker`), `agents/astra-luna-worker.toml` | input 0.20, cached 0.02, write 0.25, output 1.20 |

`src/core.mjs` also carried prices for `gpt-5.6-sol` and `gpt-5.6-terra`, which no lane used. The project ran on Codex: `codex exec` for the CLI and Codex native subagents for the skill.

## 2. Role inventory (before)

| Role | Mode | Call site | Model / effort | Input → output | Retry / fallback |
|---|---|---|---|---|---|
| Primary | Native | User's Codex conversation | Astra, user's effort | Conversation → plan, packets, integration | None automatic. "Larger model only with a concrete reason" (unspecified) |
| `astra_luna_worker` | Native | Codex `spawn_agent`, `.codex/agents/*.toml` | Luna, medium | Task packet → edits in owned files | One repair round by default |
| `astra_review` | Native | Codex `spawn_agent`, `sandbox_mode=read-only` | Astra, low | Diff and checks → accept / fix / blocked | Fresh review after a material fix |
| `planner` | CLI | `runner.mjs` `call("planner","plan")`, team mode | Astra, low | Goal and context → plan JSON (`--output-schema`, enum-scoped file fields) | None. Plan validation failure ends the run |
| `planner` (solo) | CLI | Same lane implements all outputs in `mode: "solo"` | Astra, low | → patch JSON | Same lane repairs |
| `worker` | CLI | `generate()`, parallel per task | Luna, medium | Task and context → full file contents (patch JSON) | `maxRepairs` rounds, **same lane always** |
| `reviewer` | CLI | `review-N` after checks pass | Astra, low | Candidate, context and real checks → verdict JSON | A `fix` verdict triggers a repair round |

Shared limits: `maxWorkers ≤ 4`, `maxCalls`, `maxRepairs`, `maxPromptChars`, `stopAfterTokens` (admission stop), `timeoutSeconds`. Every CLI call starts a fresh request with no tools. There was no provider fallback and no silent model substitution, and the project's rules forbid both.

## 3. Verified model facts (Claude)

| Fact | Opus 5.5 | Sonnet 5.5 | Source |
|---|---|---|---|
| API model ID | `claude-opus-5-5` | `claude-sonnet-5-5` | [Models overview](https://platform.claude.com/docs/en/about-claude/models/overview). Both IDs were also accepted by `claude -p --model` on 2026-11-02 |
| Release | 2026-09-22 | 2026-09-28 | Launch posts ([Opus](https://www.anthropic.com/claude-opus-5-5), [Sonnet](https://www.anthropic.com/claude-sonnet-5-5)) |
| Context window | 1M | 1M | Models overview |
| Price / 1M: input, 5m write, 1h write, cache read, output | 4, 5, 8, 0.20, 20 | 2, 2.50, 4, 0.10, 10 | [Pricing](https://platform.claude.com/docs/en/about-claude/pricing). Cross-checked against the CLI's own per-model `costUSD` on live calls |
| Long-context surcharge | None | None | Pricing |
| Effort | `low` … `max`; thinking cannot be disabled | `low` … `max`; default `high` | [Effort](https://platform.claude.com/docs/en/build-with-claude/effort), [thinking](https://platform.claude.com/docs/en/build-with-claude/thinking) |
| Structured output | `--json-schema` (CLI), `output_config.format` (API) | Same | [Headless](https://code.claude.com/docs/en/headless), [structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) |
| Claude Code requirement | — | 2.1.284+ | [Model config](https://code.claude.com/docs/en/model-config) |

## 4. Benchmark evidence

Accessed 2026-11-02. **A** = official vendor figure. **I** = independent evaluator. Conditions differ between rows, so no row is a like-for-like comparison of our settings.

| Capability | Evidence | Conditions | Grade |
|---|---|---|---|
| Overall reasoning at our effort levels | AA Intelligence Index v5.0: Opus 5.5 **35** low, **48** medium, 58 max. GPT-6 Astra **43** low, 51 medium, 57 max. Sonnet 5.5: 30 medium, 54 max. Luna not scored | Artificial Analysis harness ([Opus vs Astra](https://artificialanalysis.ai/models/releases/comparisons/gpt-6-astra-vs-claude-opus-5-5)) | I |
| Agentic terminal coding | Terminal-Bench 4.0 (AA): Opus 31.3 low, 52.5 medium. Astra 41.9 low. Sonnet 64 max. Luna **1** at medium, 12 at max | Same AA harness for all | I |
| Agentic terminal coding (vendor) | Opus 66.4 (xhigh), Sonnet 70.6 (max), Astra 57.9 (high, OpenAI-reported) | Different efforts, harnesses and egress | A |
| Coding (repository tasks) | SWE-bench Pro: Opus 89.9, Sonnet 81.3 | Max effort, 5 trials | A |
| Long-context coding | ProgramBench: Opus 91.2, Sonnet 79.7 | mini-swe-agent | A |
| Long-horizon work | FrontierSWE v2: Opus 62.3, Sonnet 61.9, Astra 65.5 | Max effort, 5 trials | A |
| Tool-use consistency | Toolathlon Pass³: Opus 72.2, Sonnet 68.5 (equal Pass@1, 77.8); Opus used fewer turns (26.9 vs 31.6) | Max effort | A |
| Code review / bug finding | CodeRabbit set (13 bugs): Opus found 8 at standard effort with 66.7% precision; Sonnet found 6 with 41.2% precision | Small sample | I |
| Latency | Time to first token: Opus 6.2 s low, 16.4 s medium. Sonnet 3.75 s medium. Astra 2.0 s low. Output speed: Opus 80 t/s, Sonnet 101 t/s (medium) | AA, includes thinking | I |
| Planning / task decomposition, structured-output reliability | **No direct benchmark found** for any of the four models | — | — |
| Luna capability | No official OpenAI capability benchmark reachable. AA lists Luna as deprecated | — | — |

**Confirmed facts:** IDs, prices, context windows, effort values and CLI flags listed above, plus the live behaviour recorded in [claude-live-results.md](claude-live-results.md).
**Indirect evidence:** the benchmark rows. They use different efforts, harnesses and dates from our configuration.
**Estimates still needing verification:** that Opus at medium plans and reviews at least as well as Astra at low *for this project*; that Sonnet at medium implements at least as well as Luna at medium. Each rests on two Cache Lab samples per arm plus one native smoke test. All final outputs matched the historical ones on the same 11 tests and 8 browser checks.

## 5. Role mapping (after)

| Role | Before | After | Main reason | Expected difference |
|---|---|---|---|---|
| Native primary | Astra, user's effort | **Opus 5.5**, user's effort | Frontier tier, as Astra was. Leads Sonnet on long-context coding, consistency and review precision | Comparable. User-selected, so the skill cannot enforce it |
| Native worker `astra-worker` | Luna medium | **Sonnet 5.5 medium** | Bounded, well-specified implementation. Sonnet matches or beats Opus on Terminal-Bench, Toolathlon Pass@1 and FrontierSWE, is faster, and costs half as much. It is far above Luna on every shared measure | Implementation quality likely **higher** than Luna; ~10× Luna's token price |
| Native reviewer `astra-review` | Astra low, read-only | **Opus 5.5 medium**, tools Read/Grep/Glob/Bash | Review is the acceptance gate. Opus leads on review precision. **At low effort Opus scores below Astra low** (AA 35 vs 43; TB 31.3 vs 41.9). At medium it exceeds Astra low (48; 52.5) | Reviews stricter than before. Slower first token (≈16 s vs ≈2 s) |
| CLI `planner` (team) | Astra low | **Opus 5.5 medium** | Plans set the file contracts every worker depends on. Both recorded historical failures were planner contract errors. Same effort reasoning as the reviewer | Plans more detailed. Higher latency |
| CLI `planner` (solo implementer) | Astra low | **Opus 5.5 medium** | Solo is the single-model comparison arm; it keeps the frontier model, as before | — |
| CLI `worker` | Luna medium | **Sonnet 5.5 medium** | As for the native worker | — |
| CLI `reviewer` | Astra low | **Opus 5.5 medium** | As for the native reviewer | — |
| CLI `escalation` (new, optional) | — | **Opus 5.5 medium** | Used only under the observable conditions below | Extra calls only when triggered, inside existing budgets |

The roles were **not** assigned by price ("expensive model manages, cheap model works"). The price argument mostly disappears: Opus costs only 2× Sonnet, where Astra cost 50× Luna. The split is kept because the evidence favours it per role. Opus is stronger where independent judgment and long context matter (review, planning). Sonnet is equal or better on bounded agentic coding and faster. Keeping implementer and reviewer on different models also preserves independent review in team mode.

**Effort change, and why it is not a budget change.** Planner and reviewer moved from `low` to `medium` because effort scales are not comparable across providers, and the only same-harness evidence shows Opus `low` below Astra `low`. `maxCalls`, `maxRepairs`, `maxPromptChars`, `stopAfterTokens`, `timeoutSeconds` and `maxWorkers` are unchanged in every example job.

## 6. Escalation policy (Sonnet → Opus)

Before, a repair always reused the worker's lane, and an unusable worker answer ended the run. Sonnet and Opus are close on many coding measures, so routine duplication would add cost without evidence of benefit. Escalation is therefore **condition-based, one-way and recorded**:

| Condition | Observable signal | Action |
|---|---|---|
| Unusable output | Call succeeded, but there is no schema-valid answer (`error_max_structured_output_retries` or no `structured_output`), `stop_reason: max_tokens`, or the patch violates ownership or path rules | Retry **that task once** on `models.escalation` (`<task>-escalated`) |
| Repeated failure | Checks or review still fail **after a repair already made by the worker lane** (round ≥ 1) | The next repair of each task uses the escalation lane |
| Declared difficulty (native only) | Before delegation: coupled files that cannot be split, or an unsettled design | The Opus primary keeps the task |

Never escalated: non-zero exit, authentication or transport errors, `is_error`, a timeout, budget admission, or a call served by a different model than requested (that call is rejected). Escalated calls count toward `maxCalls` and `stopAfterTokens`. An escalation is recorded in `receipt.escalations` only if its call can still be admitted, and is marked `executed` with the call ID when that call starts. `stopAfterTokens` also counts tokens from the CLI's own auxiliary model calls, so the budget is never undercounted. With the example `maxRepairs: 1`, the repeated-failure rule cannot fire, so default behaviour matches the old one apart from the unusable-output retry. No `--fallback-model` is passed, so an overloaded model fails rather than being silently replaced.

## 7. Provider/API option mapping

| Codex (`codex exec`) | Claude (`claude -p`) | Note |
|---|---|---|
| `-m <model>` | `--model claude-…` | Full IDs only. `validateJob` rejects aliases and `gpt-*` |
| `-c model_reasoning_effort=…` | `--effort low…max` | Same value set |
| `--output-schema file` + `-o answer.json` | `--json-schema '<inline>'` → `structured_output` | Enum-scoped plan schema unchanged |
| `--json` (JSONL `turn.completed` usage) | `--output-format json` → `modelUsage[model]` | Per-model usage. Unrequested host models (e.g. Haiku used by the CLI itself) are recorded separately as `auxiliary` |
| `-s read-only` | `--tools ""` | No tools at all, which is stricter than read-only |
| `--ignore-user-config` | `--setting-sources ""`, `--strict-mcp-config`, `--disable-slash-commands`, custom `--system-prompt` | `--bare` was rejected: it requires `ANTHROPIC_API_KEY` and fails with subscription/OAuth login |
| `--ephemeral` | `--no-session-persistence` | — |
| `-C dir` | Child process `cwd` | — |
| `--skip-git-repo-check` | Not needed | — |
| `CODEX_BIN` / `--codex` | `CLAUDE_BIN` / `--claude` | `--codex` now fails with an explanatory message |
| (none) | `DISABLE_PROMPT_CACHING` per `job.promptCaching` | See [live results](claude-live-results.md) |
| Usage: input includes cached | Claude reports uncached, cache read and cache write separately | Normalized to total input, so receipts stay comparable |
| Short-context cut-off at 272K | None | No long-context surcharge for these models |

## 8. Files

Removed from the active path (still in git history at `f0499da`): `plugins/astra-orchestrator/.codex-plugin/plugin.json`, `agents/astra-luna-worker.toml`, `agents/astra-review.toml`, `skills/astra-orchestrator/agents/openai.yaml`, `.agents/plugins/marketplace.json`, and the `gpt-*` price table.

Added: `.claude-plugin/marketplace.json`, `plugins/astra-orchestrator/.claude-plugin/plugin.json`, `agents/astra-worker.md`, `agents/astra-review.md`, `scripts/publish-claude-evidence.mjs`, `examples/published-claude/`, and this document.

Preserved as historical evidence: `examples/published/`, `examples/native-smoke/`, `examples/native-cache-lab/`, `docs/live-results.md`, `docs/experiment-protocol.md`, and the Codex sections of `docs/native-validation.md`. The Cache Lab seed (`CONTRACT.md`, tests) still describes Astra/Luna **prices as calculator content**. It was left unchanged so that before and after runs use identical inputs and success criteria. It does not route any model call.

Existing projects that installed the Codex version keep `.agents/skills/astra-orchestrator/` and `.codex/…`. The new installer neither reads nor deletes them.

## 9. Remaining risks

- **One sample per arm.** Model quality conclusions for this project rest on one Cache Lab team run and one solo run. Repeat runs with controlled order before claiming parity.
- **Native mode: one run.** One headless run completed the full Opus primary → Sonnet worker → Opus review → repair → fresh review loop through the real plugin. Interactive sessions, automatic skill selection and live escalation were not exercised. See [native-validation.md](native-validation.md).
- **Sonnet first-pass compliance.** In both live team runs, the first Sonnet (medium) UI output missed an explicit requirement (reject blank fields). The Opus review caught it and one repair fixed it. Worker effort was **not** raised on two samples. If this recurs across more tasks, try `high` for the worker before changing the role split.
- **Latency.** Opus medium has a much slower first token than Astra low. Expect longer plan and review steps.
- **Cost profile changed.** The worker is ~10× Luna's price, and planner/reviewer about 0.4× Astra's. In the live sample, team cost 41.9% more than solo (it used to be 22.5% cheaper). Prefer solo for small coupled tasks, and measure per task.
- **Auxiliary host calls.** Claude Code may make small calls to other models (Haiku 5.5 was observed). They are recorded separately and reported, not hidden, and do not affect role routing.
- **Native read-only.** The reviewer's Bash can write files, and plugin subagents ignore `permissionMode`.
- **Aliases.** If the subagent files are missing, the `Agent` tool can request only `opus`/`sonnet` aliases, which follow newer releases.
