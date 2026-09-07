# Native setup

The skill uses Codex's native subagent tools. It does not call the standalone runner.

Select Astra for the primary conversation. If native spawn exposes explicit model and effort arguments, the skill can request Luna medium and Astra low directly. Otherwise install the provided named profiles in the target project and start a new trusted Codex task.

From the cloned astra-orchestrator repository:

```sh
node plugins/astra-orchestrator/scripts/install-native.mjs --project /absolute/path/to/your/project
```

This installs the skill and the two named roles for that project. If the plugin already supplies the skill, use `--roles-only` to avoid duplicate skill entries. It does not change `config.toml`, the primary model, permissions, authentication, MCP settings, or `AGENTS.md`.

```sh
node plugins/astra-orchestrator/scripts/install-native.mjs --project /absolute/path/to/your/project --roles-only
```

The installer previews with `--dry-run` and verifies with `--check`. It refuses modified or conflicting destination files. A host that exposes no native delegation cannot run this workflow; use a compatible Codex client or explicitly choose the separate CLI mode.

Official references: [skills](https://learn.chatgpt.com/docs/build-skills), [subagents and role files](https://learn.chatgpt.com/docs/agent-configuration/subagents), [plugins](https://learn.chatgpt.com/docs/plugins).
