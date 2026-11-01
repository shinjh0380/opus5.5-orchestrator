---
name: astra-orchestrator
description: Coordinate Claude Code implementation with Opus 5.5 planning and review and focused Sonnet 5.5 native subagents. Use when the user requests Astra orchestration, Opus/Sonnet planner-worker delegation, bounded delegation, or this workflow for a coding task. Plain questions about models or pricing do not require delegation.
---

# Astra Orchestrator

Use the current Claude Code conversation to plan, delegate through native subagents (the `Agent` tool), verify, and deliver the user's task. This skill does not launch `claude -p`, create separate sessions, or require a job JSON file. The standalone CLI is a separate, explicitly selected workflow.

## Select a proportionate route

For a tiny change, stay with the primary agent unless the user explicitly asks for delegation. For a well-bounded implementation, use one Sonnet implementer followed by an independent Opus reviewer. Use two concurrent implementers only when their output files and contracts are independent. Do not create more workers simply to demonstrate orchestration.

State the route and owned files briefly before starting. Preserve explicit user choices about models, effort, scope, and review. Do not promise lower cost or cache reuse.

The intended primary model is Claude Opus 5.5 (`claude-opus-5-5`) at the user's chosen effort. The skill cannot switch the current conversation's model. If runtime metadata identifies another model, disclose the difference; do not claim Opus planned the work. Ask the user to select Opus (`/model claude-opus-5-5`) only when that exact root model is required to satisfy the request. An unknown model is unverified, not evidence of a mismatch.

## Subagent and role check

Use the installed subagents when they are listed:

- `astra-worker`: Claude Sonnet 5.5 (`claude-sonnet-5-5`), effort medium, implementation.
- `astra-review`: Claude Opus 5.5 (`claude-opus-5-5`), effort medium, independent review with Read/Grep/Glob/Bash only.

These definitions pin the model and effort. Do not attach a conflicting `model` override when spawning them. If they are absent, the `Agent` tool's `model` parameter accepts only aliases (`sonnet`, `opus`); aliases follow the latest model and cannot pin effort, so use them only after telling the user the route is unpinned, and record `requestedModel` as the alias. If `CLAUDE_CODE_SUBAGENT_MODEL_FORCE` or another host setting blocks per-spawn models, explain the missing capability and refer to [setup](references/setup.md). Never silently replace the Sonnet worker with the parent's model or fall back to a subprocess.

Give each subagent a fresh, self-contained task packet. Subagents do not see this conversation; do not paste the whole conversation into every worker. Requested routing does not prove the service's internal backend model. A subagent saying its own name is not model evidence.

## Delegate a complete contract

Before editing, inspect the current working tree and relevant interfaces. Preserve existing user changes. Decide the acceptance checks and give each implementer:

1. The concrete behavior to complete.
2. The absolute project path and exact files it owns.
3. Required interfaces, constraints, and the minimal reference paths.
4. Commands or observable behaviors that establish completion.

Tell workers that they are not alone in the codebase: do not revert others' edits, edit another worker's files, commit, publish, or expand the scope. If a shared file is needed, return that dependency to the primary agent. See [task and result examples](references/contracts.md) when a packet needs more structure.

Do useful independent integration or documentation work while workers run; do not implement the same assigned task in parallel. Respect the host's concurrency limits.

## Verify before review

Inspect the actual diff and generated files. Worker summaries alone are insufficient. Run the agreed checks. If they fail, send the specific failure and expected behavior back to a Sonnet worker (resume the original worker when the host supports it) before asking for an expensive independent review.

Default to one repair round. Move a task from Sonnet to Opus only on one of these observable conditions, and record which one applied:

- **Unusable result:** the worker edited files outside its ownership, returned no change for a required file, or stopped before finishing.
- **Repeated failure:** the same check or review finding still fails after one focused Sonnet repair.
- **Declared difficulty:** before delegation, the contract requires coordinated changes across coupled files that cannot be split, or a design decision the primary has not settled. In that case keep the task with the Opus primary instead of delegating.

Escalate by fixing it in the Opus primary or by spawning `astra-worker` with `model: "opus"` and saying so in the record. Do not run Sonnet and Opus on the same task in parallel, and do not escalate for transport, permission, or authentication errors. Stop and report a blocker when required tools, permissions, or information are missing; do not repeat an unchanged failing call. This is a workflow bound, not a hard billing limit.

After checks pass, spawn a fresh `astra-review` with the goal, allowed files, current diff, relevant reference paths, and actual check results. Ask for `accept`, `fix`, or `blocked`, with actionable file references. The reviewer must not edit or repair its own findings. A material fix invalidates the old verdict: rerun affected checks and obtain a fresh review of the changed result.

Native subagents operate under host permissions. File ownership here is an instruction plus diff verification, not the standalone runner's write filter. The reviewer has no Edit/Write tool, but Bash can write, and plugin subagents ignore `permissionMode`. Preserve that distinction when describing assurance.

## Deliver and account honestly

Finish in the main conversation: explain what changed, what was checked, and any unresolved limitation. Include a compact execution record with the selected route, requested role/model/effort, subagent IDs if exposed, owned paths, check outcomes, repairs, escalations with their condition, and review verdict.

Report token usage only when provided by a supported host tool or an explicitly scoped local record. Otherwise use `unavailable`; do not estimate tokens from words or transplant the CLI pilot's numbers. Parent context, subagent sessions, and subprocess receipts are different accounting scopes. Never claim this native path inherits the CLI's measured savings or cache behavior.
