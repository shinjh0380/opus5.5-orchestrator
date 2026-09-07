# Native skill and plugin

This mode runs in the current Codex conversation. Astra scopes and reviews; a native Luna worker implements bounded tasks. No job JSON, child `codex exec`, or additional API key is involved.

## Choose an installation

### Project skill: simplest complete setup

From a clone of this repository:

```sh
node plugins/astra-orchestrator/scripts/install-native.mjs --project /absolute/path/to/your-project --dry-run
node plugins/astra-orchestrator/scripts/install-native.mjs --project /absolute/path/to/your-project
node plugins/astra-orchestrator/scripts/install-native.mjs --project /absolute/path/to/your-project --check
```

Node.js 22+ is required. The target must be an existing directory. The installer writes only:

```text
.agents/skills/astra-orchestrator/    # SKILL.md and supporting references
.codex/agents/astra-luna-worker.toml
.codex/agents/astra-review.toml
.codex/astra-orchestrator-install.json
```

It does not edit `config.toml`, `AGENTS.md`, login credentials, permissions, or other roles. Identical files are left alone. An update is allowed only when the existing file matches the previous installer record; local modifications and unrelated conflicting files stop the installation before writes begin. Linked destination paths are rejected. Each file is replaced separately; the entire installation is not one atomic transaction.

Run the installer again after updating this repository. Inspect and resolve any reported local conflict yourself; there is no force-overwrite switch.

### Plugin: reusable skill distribution

Use a current Codex CLI:

```sh
codex plugin marketplace add dante01yoon/astra-orchestrator
codex plugin add astra-orchestrator@astra-orchestrator
```

The plugin packages the same skill. It does not automatically register companion agent TOMLs. When the host's native spawn tool supports explicit model and effort selection, the skill can use that route directly. Otherwise, from a repository clone, install the two project roles:

```sh
node plugins/astra-orchestrator/scripts/install-native.mjs --project /absolute/path/to/your-project --roles-only
```

Use `--roles-only` with the plugin so the skill is not installed twice. The Codex app and CLI support plugins; use the project skill in the IDE extension. Host versions and model access still determine which native tools are available.

The plugin skill is listed as `astra-orchestrator:astra-orchestrator`. Select it from the skill picker or use `$astra-orchestrator:astra-orchestrator` in your request. The shorter invocation below applies to the standalone project skill.

## Start a task

Open a new trusted task in the target project and select GPT-6 Astra as the primary model. Explicit invocation:

```text
$astra-orchestrator Implement CSV export for the reports page.
Keep the current API contract, run the relevant tests, and review the diff.
```

The skill also describes requests for Astra/Luna orchestration, so matching natural-language requests can activate it. It does not turn every ordinary coding task into a multi-agent job. The primary model is chosen in Codex; a skill cannot switch it.

| Role | Requested model | Effort | Scope |
|---|---|---|---|
| Primary | GPT-6 Astra, selected by you | Your choice | Scope, integration, checks, delivery |
| `astra_luna_worker` | GPT-5.6 Luna | medium | Exact owned files |
| `astra_review` | GPT-6 Astra | low | Independent review; read-only request |

Custom profiles take precedence when exposed by the host. Otherwise the skill uses supported explicit model selection in native spawn tools. It never silently uses the primary model for a missing Luna route. If model selection is unavailable, install the roles and start a new task; if native delegation itself is unavailable, the host needs support before this mode can run.

The skill passes a fresh, small task packet with file ownership, interfaces, constraints, and acceptance checks. One implementer is the default. Two are appropriate only when output files are independent and the parent has useful integration work. Tiny tasks stay solo unless delegation is explicitly requested.

## Verification and limits

The primary inspects actual changes and runs checks before starting a fresh reviewer. A repair returns to the implementer, then affected checks and review run again. One repair round is the default, with further work requiring a specific reason.

The host controls tools, permissions, concurrency, and model availability. File ownership is not a runtime write filter. The review role requests a read-only sandbox, but host overrides can broaden it. Do not confuse these instructions with the CLI's candidate and path-validation mechanism.

The final record includes the selected route, requested model/effort, agent identifiers if exposed, owned files, checks, repairs, and review verdict. Requested routing is not independent proof of a service's internal backend. Token counts and cost are `unavailable` unless supported, task-scoped host records expose them. No cost reduction is promised.

## Remove the setup

For a standalone installation, inspect `.codex/astra-orchestrator-install.json`, preserve any local changes, and remove only the files listed there plus the manifest. Leave other skills, agents, and configuration in place. There is no automatic uninstaller.

For a plugin, use Codex's plugin management UI or `codex plugin remove astra-orchestrator@astra-orchestrator`. Companion project role files installed separately remain until you remove them.

## Official documentation

- [Skills and discovery](https://learn.chatgpt.com/docs/build-skills)
- [Subagents and custom roles](https://learn.chatgpt.com/docs/agent-configuration/subagents)
- [Plugins](https://learn.chatgpt.com/docs/plugins)

The native route and installation were checked with Codex CLI 0.153.4 and the available Codex desktop native-agent tools on September 7, 2026. See [exact validation scope](native-validation.md).
