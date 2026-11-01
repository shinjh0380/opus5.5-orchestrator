import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  relativeFile,
  safeRead,
  validateJob,
  validatePlan,
  validatePatch,
  estimate,
  summarize,
  scopePlanSchema,
} from "../src/core.mjs";
import { apply } from "../src/runner.mjs";
import { sha, save } from "../src/core.mjs";
const base = JSON.parse(
  await fs.readFile(new URL("../examples/cache-lab/job.json", import.meta.url)),
);
test("scoped schema restricts file fields without restricting prose fields", () => {
  const s = scopePlanSchema(base),
    p = s.properties.tasks.items.properties;
  assert.deepEqual(p.context.items.enum, base.context);
  assert.deepEqual(p.files.items.enum, base.outputs);
  for (const k of ["id", "objective", "acceptance"])
    assert.equal(p[k].enum, undefined);
  assert.equal(s.properties.rationale.enum, undefined);
});
test("valid job is admitted; malformed budgets and command strings rejected", () => {
  assert.equal(validateJob(structuredClone(base)).maxWorkers, 2);
  for (const key of ["maxWorkers", "maxCalls", "maxRepairs", "timeoutSeconds"])
    assert.throws(() => validateJob({ ...base, [key]: -1 }));
  assert.throws(() => validateJob({ ...base, checks: ["node --test"] }));
});
test("deny path traversal, hidden files and platform path ambiguity", () => {
  for (const p of [
    "../key",
    ".env",
    "a/../b",
    "/tmp/a",
    "a//b",
    "a/.git/config",
    "a\\b",
    "C:/a",
    "a/./b",
  ])
    assert.throws(() => relativeFile(p));
  assert.equal(relativeFile("src/app.mjs"), "src/app.mjs");
});
test("deny context symlinks", async () => {
  const d = await fs.mkdtemp(path.join(os.tmpdir(), "astra-path-"));
  await fs.writeFile(path.join(d, "real"), "safe");
  await fs.symlink(path.join(d, "real"), path.join(d, "link"));
  await assert.rejects(() => safeRead(d, "link"));
  assert.equal(await safeRead(d, "real"), "safe");
});
test("planner cannot overlap ownership, omit output or invent context", () => {
  const t = {
    id: "one",
    objective: "implement",
    files: base.outputs,
    context: base.context,
    acceptance: "pass",
  };
  validatePlan({ tasks: [t] }, base);
  assert.throws(() => validatePlan({ tasks: [t, { ...t, id: "two" }] }, base));
  assert.throws(() =>
    validatePlan({ tasks: [{ ...t, files: ["calculator.mjs"] }] }, base),
  );
  assert.throws(() =>
    validatePlan({ tasks: [{ ...t, context: ["secret.txt"] }] }, base),
  );
});
test("worker cannot mutate another owner or repeat a file", () => {
  validatePatch({ files: [{ path: "a.mjs", content: "a" }] }, ["a.mjs"]);
  assert.throws(() =>
    validatePatch({ files: [{ path: "b.mjs", content: "b" }] }, ["a.mjs"]),
  );
  assert.throws(() =>
    validatePatch(
      {
        files: [
          { path: "a", content: "" },
          { path: "a", content: "" },
        ],
      },
      ["a", "b"],
    ),
  );
});
test("cost partitions input, 5-minute and 1-hour cache writes; reasoning stays within output", () => {
  const u = {
    input_tokens: 100000,
    cached_input_tokens: 80000,
    cache_write_input_tokens: 10000,
    cache_write_1h_input_tokens: 4000,
    output_tokens: 2000,
    reasoning_output_tokens: 1000,
  };
  // 10K uncached*$4 + 80K read*$0.20 + 6K 5m-write*$5 + 4K 1h-write*$8 + 2K out*$20
  assert.equal(estimate("claude-opus-5-5", u).usd, 0.158);
});
test("missing cache-write telemetry produces a range, missing usage never becomes zero", () => {
  const c = estimate("claude-opus-5-5", {
    input_tokens: 100000,
    cached_input_tokens: 80000,
    output_tokens: 2000,
  });
  assert.equal(c.kind, "range");
  assert.equal(c.min, 0.136);
  assert.ok(Math.abs(c.max - 0.216) < 1e-12);
  const d = estimate("claude-sonnet-5-5", {
    input_tokens: 100000,
    cached_input_tokens: 80000,
    cache_write_input_tokens: 10000,
    output_tokens: 2000,
  });
  assert.equal(d.kind, "range");
  assert.equal(estimate("claude-opus-5-5", null).kind, "unavailable");
  // 1M context is billed at standard rates for both models; no short-context cut-off.
  assert.equal(
    estimate("claude-sonnet-5-5", {
      input_tokens: 300000,
      cached_input_tokens: 0,
      cache_write_input_tokens: 0,
      cache_write_1h_input_tokens: 0,
      output_tokens: 1,
    }).kind,
    "standard-equivalent",
  );
});
test("legacy OpenAI models have no active price and are rejected as job lanes", () => {
  assert.equal(estimate("gpt-6-astra", { input_tokens: 1, cached_input_tokens: 0, output_tokens: 1 }).kind, "unavailable");
  const legacy = structuredClone(base);
  legacy.models.worker = { model: "gpt-5.6-luna", effort: "medium" };
  assert.throws(() => validateJob(legacy), /legacy model gpt-5.6-luna/);
  for (const model of ["opus", "sonnet", "Claude-Opus-5-5", "claude-opus-5-5 "]) {
    const j = structuredClone(base);
    j.models.planner.model = model;
    assert.throws(() => validateJob(j), /Invalid model lane planner/);
  }
  const noEscalation = structuredClone(base);
  delete noEscalation.models.escalation;
  assert.equal(validateJob(noEscalation).models.escalation, undefined);
  const badEscalation = structuredClone(base);
  badEscalation.models.escalation = { model: "claude-opus-5-5", effort: "ultra" };
  assert.throws(() => validateJob(badEscalation), /escalation/);
});
test("CLI usage is normalized per model; host auxiliary models are kept separate", () => {
  // Shape recorded from `claude -p --output-format json` (Claude Code 2.1.316).
  const result = {
    total_cost_usd: 0.1173138,
    modelUsage: {
      "claude-haiku-5-5": { inputTokens: 1178, outputTokens: 16, cacheReadInputTokens: 0, cacheCreationInputTokens: 0, costUSD: 0.0001258 },
      "claude-opus-5-5": {
        inputTokens: 2, outputTokens: 77, cacheReadInputTokens: 0, cacheCreationInputTokens: 14455,
        cacheCreationEphemeral1hInputTokens: 14455, cacheCreationEphemeral5mInputTokens: 0,
        thinkingTokens: 0, costUSD: 0.117188, canonicalModel: "claude-opus-5-5",
      },
    },
  };
  const s = summarize(result, "claude-opus-5-5");
  assert.deepEqual(s.usage, {
    input_tokens: 14457,
    cached_input_tokens: 0,
    cache_write_input_tokens: 14455,
    cache_write_1h_input_tokens: 14455,
    output_tokens: 77,
    reasoning_output_tokens: 0,
  });
  // Our list-price estimate matches the CLI's own per-model figure.
  assert.ok(Math.abs(estimate("claude-opus-5-5", s.usage).usd - 0.117188) < 1e-9);
  assert.deepEqual(s.auxiliary.map((a) => a.model), ["claude-haiku-5-5"]);
  // A call served by a model other than the requested one is not accepted.
  assert.equal(summarize(result, "claude-sonnet-5-5"), null);
  assert.equal(summarize({}, "claude-opus-5-5"), null);
});
test("apply verifies all context and candidate hashes before writes", async () => {
  const d = await fs.mkdtemp(path.join(os.tmpdir(), "astra-apply-")),
    r = path.join(d, "run"),
    target = path.join(d, "target");
  await fs.mkdir(path.join(r, "candidate"), { recursive: true });
  await fs.mkdir(target);
  await fs.writeFile(path.join(target, "contract"), "changed");
  await fs.writeFile(path.join(r, "candidate", "new.txt"), "new");
  await save(path.join(r, "receipt.json"), {
    status: "accepted",
    outputs: ["new.txt"],
    outputHashes: { "new.txt": sha("new") },
    baseline: { contract: sha("original"), "new.txt": null },
  });
  await assert.rejects(() => apply(r, target), /Source changed/);
  await assert.rejects(() => fs.access(path.join(target, "new.txt")));
  await fs.writeFile(path.join(target, "contract"), "original");
  await apply(r, target);
  assert.equal(await fs.readFile(path.join(target, "new.txt"), "utf8"), "new");
});
