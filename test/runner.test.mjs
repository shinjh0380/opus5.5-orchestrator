import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { run } from "../src/runner.mjs";
import { json, save } from "../src/core.mjs";
async function fixture(checks = [["node", "--check", "a.mjs"]]) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "astra-runner-"));
  await fs.mkdir(path.join(root, "seed"));
  await fs.writeFile(
    path.join(root, "seed", "CONTRACT.md"),
    "Export a constant.",
  );
  const j = {
    goal: "Export a constant in a.mjs",
    source: "seed",
    mode: "solo",
    context: ["CONTRACT.md"],
    outputs: ["a.mjs"],
    checks,
    maxWorkers: 1,
    maxCalls: 3,
    maxRepairs: 0,
    maxPromptChars: 5000,
    stopAfterTokens: 1000,
    timeoutSeconds: 10,
    models: {
      planner: { model: "gpt-6-astra", effort: "low" },
      worker: { model: "gpt-5.6-luna", effort: "medium" },
      reviewer: { model: "gpt-6-astra", effort: "low" },
    },
  };
  await save(path.join(root, "job.json"), j);
  const cli = path.join(root, "mock-codex.mjs");
  await fs.writeFile(
    cli,
    `#!/usr/bin/env node
import fs from 'node:fs';
const args=process.argv.slice(2),out=args[args.indexOf('-o')+1],cwd=args[args.indexOf('-C')+1];
let prompt='';for await(const c of process.stdin)prompt+=c;
const answer=cwd.includes('review-')?{verdict:'accept',summary:'Fixture acceptance',findings:[]}:{summary:'Fixture patch',files:[{path:'a.mjs',content:'export const a = 1;'}]};
fs.writeFileSync(out,JSON.stringify(answer));
console.log(JSON.stringify({type:'turn.completed',usage:{input_tokens:100,cached_input_tokens:50,cache_write_input_tokens:0,output_tokens:10}}));
`,
    { mode: 0o700 },
  );
  return {
    root,
    cli,
    job: path.join(root, "job.json"),
    out: path.join(root, "run"),
  };
}
test("mock CLI pipeline writes candidate, passes real check, then reviews", async () => {
  const f = await fixture();
  await run(f.job, { codex: f.cli, out: f.out });
  const r = await json(path.join(f.out, "receipt.json"));
  assert.equal(r.status, "accepted");
  assert.equal(r.calls.length, 2);
  assert.equal(r.checks[0].passed, true);
  assert.ok(r.outputHashes["a.mjs"]);
  assert.ok(
    (await fs.readFile(path.join(f.out, "report.html"), "utf8")).includes(
      "Fixture",
    ) === false,
  );
});
test("failed real check prevents expensive review and leaves failed receipt", async () => {
  const f = await fixture([["node", "-e", "process.exit(2)"]]);
  await assert.rejects(
    () => run(f.job, { codex: f.cli, out: f.out }),
    /Repair limit/,
  );
  const r = await json(path.join(f.out, "receipt.json"));
  assert.equal(r.status, "failed");
  assert.equal(r.calls.length, 1);
  assert.equal(r.checks[0].passed, false);
});
test("changed validation contract cannot be accepted", async () => {
  const f = await fixture([
    ["node", "-e", "require('fs').writeFileSync('CONTRACT.md','tampered')"],
  ]);
  await assert.rejects(
    () => run(f.job, { codex: f.cli, out: f.out }),
    /Read-only contract changed/,
  );
  const r = await json(path.join(f.out, "receipt.json"));
  assert.equal(r.status, "failed");
  assert.equal(r.calls.length, 1);
});
test("dry run makes no model calls, reused output directory is rejected", async () => {
  const f = await fixture();
  await run(f.job, { codex: "/does/not/exist", out: f.out, dryRun: true });
  assert.equal(
    (await json(path.join(f.out, "receipt.json"))).status,
    "dry-run",
  );
  await assert.rejects(
    () => run(f.job, { out: f.out, dryRun: true }),
    /already used/,
  );
});
