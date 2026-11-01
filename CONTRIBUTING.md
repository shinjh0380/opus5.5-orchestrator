# Contributing

Keep the two execution modes explicit:

- Native skills guide agents using host tools and permissions.
- The CLI validates structured file outputs and records subprocess usage.

Do not describe an instruction as an enforced sandbox, silently substitute models, or apply CLI measurements to native execution. Model escalation must stay explicit, condition-based and recorded.

## Local checks

Use Node.js 22+:

```sh
npm test
node bin/astra.mjs run examples/cache-lab/job.json --dry-run --out .runs/your-unique-check
node plugins/astra-orchestrator/scripts/install-native.mjs --project /absolute/path/to/a-disposable-project --dry-run
```

Tests do not call models; the runner tests use a mock `claude` executable. A live CLI run or native delegation consumes account usage. Keep raw prompts, logs, credentials, and private project paths out of public artifacts. `.runs/` is ignored for this reason.

Add tests for behavior changes to the runner or installer. Preserve existing configuration and user changes. Keep skill instructions small and place detailed contracts in references.

For a native workflow change, record the host, requested routing, task contract, actual checks, and review outcome. Mark unavailable token counts as unavailable. Preserve original pilot receipts, including the historical Astra/Luna evidence under `examples/published/`; new experiments belong in a separate directory with their own conditions and failure costs.

Explain the user-visible problem, resulting behavior, and validation in a pull request. Documentation and public discussion are in English; original evidence may retain the language in which it was generated.
