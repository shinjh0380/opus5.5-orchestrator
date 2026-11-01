// Historical: regenerates the v0.2.0 Astra/Luna evidence from its original .runs/. For Claude runs use publish-claude-evidence.mjs.
// Only share reviewed, explicitly selected artifacts. Never copy .runs/private.
import fs from "node:fs/promises";
import path from "node:path";
import { json, save, sha } from "../src/core.mjs";
import { writeReport } from "../src/report.mjs";
const root = path.resolve(import.meta.dirname, "..");
const evidence = path.join(root, "examples/published");
const totals = {};
for (const [label, run] of [
  ["team", "team-03"],
  ["solo", "solo-01"],
  ["development-failure-01", "team-01"],
  ["development-failure-02", "team-02"],
]) {
  const source = path.join(root, ".runs", run),
    dest = path.join(evidence, label);
  const receipt = await json(path.join(source, "receipt.json"));
  delete receipt.source;
  await save(path.join(dest, "receipt.json"), receipt);
  await writeReport(dest, receipt);
  totals[label] = {
    status: receipt.status,
    input: receipt.calls.reduce((n, c) => n + (c.usage?.input_tokens || 0), 0),
    output: receipt.calls.reduce(
      (n, c) => n + (c.usage?.output_tokens || 0),
      0,
    ),
    cached: receipt.calls.reduce(
      (n, c) => n + (c.usage?.cached_input_tokens || 0),
      0,
    ),
    usd: receipt.calls.reduce((n, c) => n + (c.price.usd || 0), 0),
    wallSeconds:
      (Date.parse(receipt.finishedAt) - Date.parse(receipt.startedAt)) / 1000,
  };
  if (receipt.status === "accepted") {
    for (const file of [
      "CONTRACT.md",
      "calculator.test.mjs",
      "calculator.mjs",
      "index.html",
    ])
      await fs.copyFile(
        path.join(source, "candidate", file),
        path.join(dest, file),
      );
    for (const file of ["plan.json", "review-0.json", "job.json"])
      await fs.copyFile(path.join(source, file), path.join(dest, file));
  }
}
const comparison = {
  asOf: "2026-09-07",
  cliVersion: "0.153.4",
  protocol: "docs/experiment-protocol.md",
  samplesPerArm: 1,
  cacheControlled: false,
  sequence: ["team", "solo"],
  totals,
  operatingCostDifferencePercent: 100 * (1 - totals.team.usd / totals.solo.usd),
  developmentFailuresUsd:
    totals["development-failure-01"].usd + totals["development-failure-02"].usd,
  scope:
    "Completed runs only for operating comparison; engineering failures separately included. Not a general benchmark, subscription bill, whole project production cost or cache optimization result.",
};
await save(path.join(evidence, "comparison.json"), comparison);
console.log(JSON.stringify(comparison, null, 2));
