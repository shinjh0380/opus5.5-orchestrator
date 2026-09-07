# Native-mode validation

Validation date: September 7, 2026. Host: macOS, Codex desktop native collaboration tools; installation checks used Codex CLI 0.153.4.

## Actual native implementation and review

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

## Installer and plugin checks

- The existing CLI suite plus five installer tests passed: 19/19.
- Installer cases cover configuration preservation, preview mode, idempotence, installation checks, roles-only setup, modified and unmanaged files, malformed manifests, and linked destinations.
- Both role TOMLs parsed successfully with required fields and intended model/effort values.
- Codex's plugin and skill validation scripts passed.
- In an isolated Codex home, `plugin marketplace add <local repository>`, `plugin add astra-orchestrator@astra-orchestrator`, and `plugin list --json` succeeded. The plugin was listed as installed and enabled at version 0.2.0.
- Fresh Codex app-server processes discovered both installations through `skills/list`: the plugin as `astra-orchestrator:astra-orchestrator` and the standalone skill as `astra-orchestrator` with repository scope. Both were enabled.
- An independent Astra review of the installer, role profiles, skill, and installer tests returned `accept` with no actionable code findings.

These checks did not alter the user's global Codex installation. Marketplace installation, runtime skill discovery, and explicit native invocation were tested separately. Automatic skill selection during a new desktop conversation and custom-profile routing across every Codex host were not exercised. Official discovery behavior is documented in the [setup guide](native-mode.md); start a new trusted task after installing.

The original CLI runner and its model-call flow remain intact. Public pilot receipt data and generated code are unchanged; report labels were translated into English.
