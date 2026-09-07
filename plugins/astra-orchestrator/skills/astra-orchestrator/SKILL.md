---
name: astra-orchestrator
description: Coordinate Codex implementation with Astra planning and review and focused Luna native subagents. Use when the user requests Astra/Luna orchestration, bounded delegation, or this workflow for a coding task. Plain questions about models or pricing do not require delegation.
---

# Astra Orchestrator

Use the current Codex conversation to plan, delegate through native subagent tools, verify, and deliver the user's task. This skill does not launch `codex exec`, create separate app tasks, or require a job JSON file. The standalone CLI is a separate, explicitly selected workflow.

## Select a proportionate route

For a tiny change, stay with the primary agent unless the user explicitly asks for delegation. For a well-bounded implementation, use one Luna implementer followed by an independent Astra reviewer. Use two concurrent implementers only when their output files and contracts are independent. Do not create more workers simply to demonstrate orchestration.

State the route and owned files briefly before starting. Preserve explicit user choices about models, effort, scope, and review. Do not promise lower cost or cache reuse.

The intended primary model is GPT-6 Astra at the user's chosen effort. The skill cannot switch the current conversation's model. If runtime metadata identifies another model, disclose the difference; do not claim Astra planned the work. Ask the user to select Astra only when that exact root model is required to satisfy the request. An unknown model is unverified, not evidence of a mismatch.

## Native tool and role check

Use the native spawn, message, wait, and close/interrupt tools exposed by this host. Inspect their actual schema; names and supported arguments vary. Use the installed profiles when listed:

- `astra_luna_worker`: GPT-5.6 Luna, medium, implementation.
- `astra_review`: GPT-6 Astra, low, independent review with a read-only request.

These profiles pin the model and effort. Do not attach conflicting model overrides. If a profile is absent but the native spawn tool explicitly supports both model and effort, request the same values with an appropriate built-in role. Use a fresh context (`fork_turns: "none"` when supported) and the task contract below. Do not fork the entire conversation into every worker.

If the host supports neither the required profiles nor explicit model selection, explain the missing capability and refer to [setup](references/setup.md). Never silently replace Luna with the parent's model or fall back to a subprocess. Public spawn metadata establishes requested routing; it does not prove the service's internal backend model. Record omitted fields as unverified. A worker saying its own name is not model evidence.

## Delegate a complete contract

Before editing, inspect the current working tree and relevant interfaces. Preserve existing user changes. Decide the acceptance checks and give each implementer:

1. The concrete behavior to complete.
2. The absolute project path and exact files it owns.
3. Required interfaces, constraints, and the minimal reference paths.
4. Commands or observable behaviors that establish completion.

Tell workers that they are not alone in the codebase: do not revert others' edits, edit another worker's files, commit, publish, or expand the scope. If a shared file is needed, return that dependency to the primary agent. See [task and result examples](references/contracts.md) when a packet needs more structure.

Do useful independent integration or documentation work while workers run; do not implement the same assigned task in parallel. Use messages and bounded waits to follow actual progress, preserving the host's concurrency limits. Reuse the original worker for a focused correction when possible.

## Verify before review

Inspect the actual diff and generated files. Worker summaries alone are insufficient. Run the agreed checks. If they fail, send the specific failure and expected behavior to the original worker before asking for an expensive independent review.

Default to one repair round. More retries or a larger model require a concrete reason supported by the failure and the user's scope. This is a workflow bound, not a hard billing limit. Stop and report a blocker when required tools, permissions, or information are missing; do not repeat an unchanged failing call.

After checks pass, start a fresh Astra reviewer with the goal, allowed files, current diff, relevant reference paths, and actual check results. Ask for `accept`, `fix`, or `blocked`, with actionable file references. The reviewer must not edit or repair its own findings. A material fix invalidates the old verdict: rerun affected checks and obtain a fresh review of the changed result.

Native workers operate under host permissions. File ownership here is an instruction plus diff verification, not the standalone runner's write filter. A role's read-only setting may be broadened by live host overrides. Preserve that distinction when describing assurance.

## Deliver and account honestly

Finish in the main conversation: explain what changed, what was checked, and any unresolved limitation. Include a compact execution record with the selected route, requested role/model/effort, native agent IDs if exposed, owned paths, check outcomes, repairs, and review verdict.

Report token usage only when provided by a supported host tool or an explicitly scoped local record. Otherwise use `unavailable`; do not estimate tokens from words or transplant the CLI pilot's numbers. Parent context, native worker sessions, and subprocess receipts are different accounting scopes. Do not scan unrelated conversations for usage. Never claim this native path inherits the CLI's measured savings or cache behavior.
