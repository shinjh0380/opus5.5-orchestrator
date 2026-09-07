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
test("cost partitions input and counts reasoning only within output", () => {
  const u = {
    input_tokens: 100000,
    cached_input_tokens: 80000,
    cache_write_input_tokens: 10000,
    output_tokens: 2000,
    reasoning_output_tokens: 1000,
  };
  assert.equal(estimate("gpt-6-astra", u).usd, 0.405);
});
test("missing cache writes produce a range, missing usage never becomes zero", () => {
  const c = estimate("gpt-6-astra", {
    input_tokens: 100000,
    cached_input_tokens: 80000,
    output_tokens: 2000,
  });
  assert.equal(c.kind, "range");
  assert.equal(c.min, 0.38);
  assert.equal(c.max, 0.43);
  assert.equal(estimate("gpt-6-astra", null).kind, "unavailable");
  assert.equal(
    estimate("gpt-6-astra", {
      input_tokens: 300000,
      cached_input_tokens: 0,
      output_tokens: 1,
    }).kind,
    "unavailable",
  );
});
test("multiple turns sum fields only if every turn reports them", () => {
  const u = summarize([
    {
      type: "turn.completed",
      usage: {
        input_tokens: 10,
        cached_input_tokens: 2,
        output_tokens: 1,
        cache_write_input_tokens: 3,
      },
    },
    {
      type: "turn.completed",
      usage: { input_tokens: 20, cached_input_tokens: 5, output_tokens: 2 },
    },
  ]);
  assert.equal(u.input_tokens, 30);
  assert.equal(u.output_tokens, 3);
  assert.equal(u.cache_write_input_tokens, undefined);
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
