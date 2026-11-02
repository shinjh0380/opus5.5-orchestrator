# Native setup

The skill uses Claude Code's native subagents (the `Agent` tool). It does not call the standalone runner.

Select Claude Opus 5.5 for the primary conversation (`/model claude-opus-5-5`). The plugin ships the two pinned subagents (`opus-worker`: Sonnet 5.5 medium; `opus-review`: Opus 5.5 medium), so a plugin installation is complete. For a project installation without the plugin, install the skill and subagents into the target project and start a new Claude Code session there.

From the cloned opus-orchestrator repository:

```sh
node plugins/opus-orchestrator/scripts/install-native.mjs --project /absolute/path/to/your/project
```

This installs the skill into `.claude/skills/` and the two subagents into `.claude/agents/`. Use `--roles-only` to install only the subagents (for example, when you keep the skill elsewhere). It does not change `settings.json`, `CLAUDE.md`, the primary model, permissions, authentication, or MCP settings.

```sh
node plugins/opus-orchestrator/scripts/install-native.mjs --project /absolute/path/to/your/project --roles-only
```

The installer previews with `--dry-run` and verifies with `--check`. It refuses modified or conflicting destination files. Sonnet 5.5 requires Claude Code 2.1.284 or later. If `CLAUDE_CODE_SUBAGENT_MODEL_FORCE` or managed settings force one subagent model, the pinned routing cannot be honored; the skill reports that instead of silently using another model.

Official references: [skills](https://code.claude.com/docs/en/skills), [subagents](https://code.claude.com/docs/en/sub-agents), [plugins](https://code.claude.com/docs/en/plugins), [model configuration](https://code.claude.com/docs/en/model-config).
