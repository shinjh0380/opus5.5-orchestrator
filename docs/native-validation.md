# Native-mode validation

## Claude Code: Opus 5.5 / Sonnet 5.5 (current)

Validation date: November 2, 2026. Host: Linux, Claude Code 2.1.316.

### Plugin and installer

- `claude plugin validate ./plugins/opus-orchestrator` and `claude plugin validate .` (marketplace) both passed.
- In an isolated home directory, `claude plugin marketplace add <repository>` and `claude plugin install opus-orchestrator@opus-orchestrator` succeeded. `claude plugin list` showed the plugin enabled, and `claude plugin details` listed skill `opus-orchestrator` and agents `opus-review` and `opus-worker`. Plugins ship their agents, so no separate role installation is needed.
- The installer test suite covers the `.claude/` destinations, settings preservation, idempotence, `--check`, `--roles-only`, modified and unmanaged files, malformed manifests, linked destinations, and pinned model/effort values in the installed subagents. A test also asserts that no installed file mentions a legacy model.

### Actual native implementation and review

> This run happened before the rename. The plugin, skill and subagents were then called `astra-orchestrator`, `astra-worker` and `astra-review`, as [record.json](../examples/native-smoke-claude/record.json) shows; their definitions are unchanged apart from the names.

Same contract and tests as the September Astra/Luna smoke test. The primary was `claude-opus-5-5` (reported by the host). The plugin was loaded with `--plugin-dir`, and the request explicitly asked for one worker and a fresh reviewer.

- The primary inspected the contract, then spawned `opus-orchestrator:opus-worker` (definition: Sonnet 5.5, medium, no per-spawn override). The worker wrote `csv.mjs`, and the primary's checks passed 5/5.
- A fresh `opus-orchestrator:opus-review` (Opus 5.5, medium) returned **fix**: sparse-array holes such as `toCsv([[,'a']])` skipped type validation. The tests do not cover this.
- Resuming the first worker was impossible because the run used `--no-session-persistence`. A fresh Sonnet worker repaired the file, and the primary recorded this explicitly as *not* an escalation.
- The primary reran 5/5 checks and the sparse-array probes. A second fresh reviewer returned **accept**. `git diff` showed only `csv.mjs`.
- Host per-model usage listed only `claude-opus-5-5` (≈$0.50 list-price estimate) and `claude-sonnet-5-5` (≈$0.14). Total wall time was 114 s.

[Contract, tests, implementation and execution record](../examples/native-smoke-claude/record.json). Recheck locally without a model call: `node --test examples/native-smoke-claude/csv.test.mjs`.

This was one headless run with the request naming the route. Automatic skill selection in an interactive session, the Agent tool's alias fallback when subagent files are missing, and the escalation rules (none triggered) were not exercised live. The final `csv.mjs` behaves the same as the Astra/Luna output on the contract tests and the sparse-array probes.

## Codex: GPT-6 Astra / GPT-5.6 Luna (historical, v0.2.0)

> Kept unchanged as the comparison baseline. These checks used Codex and the previous `.codex/` role files, which are no longer shipped.

Validation date: September 7, 2026. Host: macOS, Codex desktop native collaboration tools; installation checks used Codex CLI 0.153.4.

### Actual native implementation and review

The primary loaded the new skill and gave a native worker a small CSV-serializer contract. The worker owned only `csv.mjs`; the primary supplied the contract and five acceptance tests beforehand.

- Worker request: built-in `worker` role, `gpt-5.6-luna`, medium effort, fresh context.
- Primary inspected the returned code and ran the checks: 5/5 passed.
- Independent reviewer request: built-in `default` role, `gpt-6-astra`, low effort, fresh context, read-only instructions.
- The reviewer independently reran 5/5 checks and returned `accept`.
- Repair rounds: 0. No `codex exec` implementation or review call was used.

The live host exposes explicit model and effort selection, so this tested the skill's direct native routing path. Newly installed custom profiles were not loaded into the existing conversation. The primary model was not independently identified by a host field. Requested routing does not independently verify the service's internal backend model.

[Contract](../examples/native-smoke/CONTRACT.md), [tests](../examples/native-smoke/csv.test.mjs), [generated implementation](../examples/native-smoke/csv.mjs), and [execution record with artifact hashes](../examples/native-smoke/record.json) are available. Recheck the artifact locally without a model call:

```sh
node --test examples/native-smoke/csv.test.mjs
```

Token usage and API-equivalent cost are **unavailable** for this native test. The earlier CLI pilot is a different accounting scope and is not substituted here. This small test demonstrates the routing and review workflow, not performance on large repositories or general cost savings.

### Installer and plugin checks

- The existing CLI suite plus five installer tests passed: 19/19.
- Installer cases cover configuration preservation, preview mode, idempotence, installation checks, roles-only setup, modified and unmanaged files, malformed manifests, and linked destinations.
- Both role TOMLs parsed successfully with required fields and intended model/effort values.
- Codex's plugin and skill validation scripts passed.
- In an isolated Codex home, `plugin marketplace add <local repository>`, `plugin add astra-orchestrator@astra-orchestrator`, and `plugin list --json` succeeded. The plugin was listed as installed and enabled at version 0.2.0.
- Fresh Codex app-server processes discovered both installations through `skills/list`: the plugin as `astra-orchestrator:astra-orchestrator` and the standalone skill as `astra-orchestrator` with repository scope. Both were enabled.
- An independent Astra review of the installer, role profiles, skill, and installer tests returned `accept` with no actionable code findings.

These checks did not alter the user's global Codex installation. Marketplace installation, runtime skill discovery, and explicit native invocation were tested separately. Automatic skill selection during a new desktop conversation and custom-profile routing across every Codex host were not exercised. Official discovery behavior is documented in the [setup guide](native-mode.md); start a new trusted task after installing.

The original CLI runner and its model-call flow remain intact. Public pilot receipt data and generated code are unchanged; report labels were translated into English.

### Recorded feature demo

A later interactive CLI run exercised the installed custom profiles end to end: Astra low → `astra_luna_worker` (Luna medium) → `astra_review` (Astra low). It added real CSV downloads to Cache Lab, passed 14 tests and an independent review, and was checked in a browser with two actual downloads plus an invalid-input case. [Generated files and reproduction instructions](../examples/native-cache-lab/README.md) are public. This adds custom-profile evidence for CLI 0.153.4; it does not establish compatibility with every host.
