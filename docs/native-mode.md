# Native skill and plugin (Claude Code)

This mode runs in the current Claude Code conversation. Opus 5.5 scopes, integrates and reviews; a native Sonnet 5.5 subagent implements bounded tasks. No job JSON, child `claude -p` process, or additional API key is involved; native work uses your Claude Code account and model access.

## Choose an installation

### Plugin: complete setup in one step

```sh
claude plugin marketplace add shinjh0380/opus5.5-orchestrator
claude plugin install opus-orchestrator@opus-orchestrator
```

Or inside a session: `/plugin install opus-orchestrator --marketplace shinjh0380/opus5.5-orchestrator`. Claude Code plugins load the plugin's `agents/` directory automatically, so the plugin ships the skill **and** both pinned subagents. The skill is listed as `opus-orchestrator:opus-orchestrator`.

### Project installation

From a clone of this repository:

```sh
node plugins/opus-orchestrator/scripts/install-native.mjs --project /absolute/path/to/your-project --dry-run
node plugins/opus-orchestrator/scripts/install-native.mjs --project /absolute/path/to/your-project
node plugins/opus-orchestrator/scripts/install-native.mjs --project /absolute/path/to/your-project --check
```

Node.js 22+ is required. The target must be an existing directory. The installer writes only:

```text
.claude/skills/opus-orchestrator/    # SKILL.md and supporting references
.claude/agents/opus-worker.md
.claude/agents/opus-review.md
.claude/opus-orchestrator-install.json
```

It does not edit `settings.json`, `CLAUDE.md`, login credentials, permissions, or other subagents. Identical files are left alone. An update is allowed only when the existing file matches the previous installer record; local modifications and unrelated conflicting files stop the installation before writes begin. Linked destination paths are rejected. Each file is replaced separately; the installation is not one atomic transaction. `--roles-only` installs just the two subagents. Choose either the plugin or the project skill to avoid duplicate skill entries.

## Start a task

Open Claude Code in the target project, select Opus 5.5 as the primary model (`/model claude-opus-5-5`), and invoke the skill:

```text
/opus-orchestrator Implement CSV export for the reports page.
Keep the current API contract, run the relevant tests, and review the diff.
```

| Role | Model | Effort | Scope |
|---|---|---|---|
| Primary | Claude Opus 5.5, selected by you | Your choice | Scope, integration, checks, delivery, escalated fixes |
| `opus-worker` | Claude Sonnet 5.5 (`claude-sonnet-5-5`) | medium | Exact owned files |
| `opus-review` | Claude Opus 5.5 (`claude-opus-5-5`) | medium | Independent review; Read/Grep/Glob/Bash only |

Subagent definitions pin full model IDs and effort. If they are missing, the `Agent` tool accepts only model aliases (`sonnet`, `opus`) and no effort; the skill discloses that the route is unpinned. It never silently uses the primary model for a missing worker route. Sonnet 5.5 needs Claude Code 2.1.284+. `CLAUDE_CODE_SUBAGENT_MODEL_FORCE` or managed settings can override subagent models.

The skill passes a fresh, small task packet with file ownership, interfaces, constraints, and acceptance checks. One implementer is the default; two only when output files are independent. Tiny tasks stay with the primary unless delegation is explicitly requested.

## Verification, repair and escalation

The primary inspects actual changes and runs checks before spawning a fresh reviewer. A repair returns to the Sonnet worker, then affected checks and review run again. One repair round is the default.

A task moves from Sonnet to Opus only on an observable condition, recorded in the execution record: an **unusable result** (edits outside ownership, missing required change, unfinished output), a **repeated failure** (the same check or finding still fails after one Sonnet repair), or a **declared difficulty** known before delegation (coupled files that cannot be split, unsettled design), in which case the Opus primary keeps the task. Transport, permission and authentication errors are never escalation reasons.

The host controls tools, permissions, concurrency, and model availability. File ownership is not a runtime write filter. The reviewer has no Edit/Write tool, but Bash can write, and plugin subagents ignore `permissionMode`. Do not confuse these instructions with the CLI's candidate and path-validation mechanism.

The final record includes the route, requested model/effort, subagent identifiers if exposed, owned files, checks, repairs, escalations, and review verdict. Requested routing is not independent proof of a service's internal backend. Token counts and cost are `unavailable` unless a supported, task-scoped host record exposes them. No cost reduction is promised.

## Remove the setup

For a project installation, inspect `.claude/opus-orchestrator-install.json`, preserve any local changes, and remove only the files listed there plus the manifest. There is no automatic uninstaller. For the plugin, use `/plugin` or `claude plugin uninstall opus-orchestrator@opus-orchestrator`.

A project previously set up for the Codex version keeps `.agents/skills/astra-orchestrator/`, `.codex/agents/astra-*.toml` and `.codex/astra-orchestrator-install.json`. Claude Code does not read them; remove them by hand if you no longer use Codex. See [migration notes](migration-claude.md).

## Official documentation

- [Skills](https://code.claude.com/docs/en/skills)
- [Subagents](https://code.claude.com/docs/en/sub-agents)
- [Plugins](https://code.claude.com/docs/en/plugins) and [plugin marketplaces](https://code.claude.com/docs/en/plugins/marketplace-reference)
- [Model configuration and effort](https://code.claude.com/docs/en/model-config)

Validation scope for this mode is in [native-validation.md](native-validation.md).
