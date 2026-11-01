// Publish reviewed Claude (Opus 5.5 / Sonnet 5.5) Cache Lab runs next to the historical
// Astra/Luna evidence, without touching examples/published/. Never copies .runs/*/private.
// Usage: node scripts/publish-claude-evidence.mjs <label>=<run-dir> [...]
import fs from "node:fs/promises";
import path from "node:path";
import { json, save, relativeFile } from "../src/core.mjs";
import { writeReport } from "../src/report.mjs";
const root = path.resolve(import.meta.dirname, "..");
const evidence = path.join(root, "examples/published-claude");
const historical = await json(
  path.join(root, "examples/published/comparison.json"),
);
const pairs = process.argv.slice(2).map((a) => a.split("="));
if (!pairs.length || pairs.some((p) => p.length !== 2 || !/^[a-z0-9-]+$/.test(p[0])))
  throw new Error("Usage: publish-claude-evidence.mjs label=run-dir ...");
const sum = (calls, f) => calls.reduce((n, c) => n + f(c), 0);
const totals = {};
for (const [label, run] of pairs) {
  const source = path.resolve(root, run),
    dest = path.join(evidence, label);
  const receipt = await json(path.join(source, "receipt.json"));
  delete receipt.source;
  await save(path.join(dest, "receipt.json"), receipt);
  await writeReport(dest, receipt);
  const priced = receipt.calls.length > 0 && receipt.calls.every((c) => c.price.kind === "standard-equivalent");
  totals[label] = {
    status: receipt.status,
    calls: receipt.calls.length,
    byModel: receipt.calls.reduce(
      (m, c) => ({ ...m, [c.modelRequested]: (m[c.modelRequested] || 0) + 1 }),
      {},
    ),
    input: sum(receipt.calls, (c) => c.usage?.input_tokens || 0),
    cached: sum(receipt.calls, (c) => c.usage?.cached_input_tokens || 0),
    cacheWrite: sum(receipt.calls, (c) => c.usage?.cache_write_input_tokens || 0),
    output: sum(receipt.calls, (c) => c.usage?.output_tokens || 0),
    reasoning: sum(receipt.calls, (c) => c.usage?.reasoning_output_tokens || 0),
    usd: priced ? sum(receipt.calls, (c) => c.price.usd) : null,
    auxiliaryReportedUsd: sum(receipt.calls, (c) =>
      (c.auxiliary || []).reduce((n, a) => n + (a.reportedCostUsd || 0), 0),
    ),
    cliReportedUsd: sum(receipt.calls, (c) => c.reportedCostUsd || 0),
    modelSeconds: sum(receipt.calls, (c) => c.seconds),
    wallSeconds:
      (Date.parse(receipt.finishedAt) - Date.parse(receipt.startedAt)) / 1000,
    checks: receipt.checks.map((c) => ({ round: c.round, passed: c.passed })),
    escalations: receipt.escalations,
  };
  if (receipt.status === "accepted") {
    for (const file of Object.keys(receipt.baseline)) {
      relativeFile(file);
      await fs.mkdir(path.dirname(path.join(dest, file)), { recursive: true });
      await fs.copyFile(path.join(source, "candidate", file), path.join(dest, file));
    }
    for (const file of await fs.readdir(source))
      if (/^(plan|review-\d+|job)\.json$/.test(file))
        await fs.copyFile(path.join(source, file), path.join(dest, file));
  }
}
const comparison = {
  asOf: new Date().toISOString().slice(0, 10),
  protocol: "docs/experiment-protocol.md (same contract, checks, budgets and order)",
  samplesPerArm: 1,
  cacheControlled: false,
  pricing: "Claude API Standard list prices; see receipt.pricing",
  totals,
  historicalAstraLuna: historical.totals,
  scope:
    "One uncontrolled sample per arm. Not a general benchmark, subscription bill or cache optimization result. Historical figures used different models, provider, CLI and prices.",
};
await save(path.join(evidence, "comparison.json"), comparison);
console.log(JSON.stringify(comparison, null, 2));
