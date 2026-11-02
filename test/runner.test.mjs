import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { run } from "../src/runner.mjs";
import { json, save } from "../src/core.mjs";

const OPUS = "claude-opus-5-5",
  SONNET = "claude-sonnet-5-5";
const onePlan = {
  rationale: "One worker owns the single coupled output",
  tasks: [
    {
      id: "one",
      objective: "Export a constant in a.mjs",
      files: ["a.mjs"],
      context: ["CONTRACT.md"],
      acceptance: "Checks pass",
    },
  ],
};

// A stand-in for `claude -p --output-format json --json-schema ...`.
// rules: [{ id: regex for the call id, model?: requested model, answer?, authError?,
//           servedModel?, stopReason? }]
async function fixture({
  checks = [["node", "--check", "a.mjs"]],
  mode = "solo",
  rules = [],
  maxCalls = 3,
  maxRepairs = 0,
  escalation = true,
} = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "opus-runner-"));
  await fs.mkdir(path.join(root, "seed"));
  await fs.writeFile(
    path.join(root, "seed", "CONTRACT.md"),
    "Export a constant.",
  );
  const j = {
    goal: "Export a constant in a.mjs",
    source: "seed",
    mode,
    context: ["CONTRACT.md"],
    outputs: ["a.mjs"],
    checks,
    maxWorkers: 1,
    maxCalls,
    maxRepairs,
    maxPromptChars: 5000,
    stopAfterTokens: 1000,
    timeoutSeconds: 10,
    models: {
      planner: { model: OPUS, effort: "medium" },
      worker: { model: SONNET, effort: "medium" },
      reviewer: { model: OPUS, effort: "medium" },
      ...(escalation
        ? { escalation: { model: OPUS, effort: "medium" } }
        : {}),
    },
  };
  await save(path.join(root, "job.json"), j);
  const log = path.join(root, "calls.jsonl");
  const scenario = { log, rules, plan: onePlan };
  const cli = path.join(root, "mock-claude.mjs");
  await fs.writeFile(
    cli,
    `#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
const S=${JSON.stringify(scenario)};
const args=process.argv.slice(2),flag=f=>args[args.indexOf(f)+1];
const model=flag('--model'),id=path.basename(process.cwd());
let prompt='';for await(const c of process.stdin)prompt+=c;
fs.appendFileSync(S.log,JSON.stringify({id,model,effort:flag('--effort'),args,cache:process.env.DISABLE_PROMPT_CACHING??null})+'\\n');
const rule=S.rules.find(r=>new RegExp(r.id).test(id)&&(!r.model||r.model===model))||{};
if(rule.raw!==undefined){console.log(rule.raw);process.exit(0);}
if(rule.authError){console.log(JSON.stringify({type:'result',subtype:'success',is_error:true,result:'Authentication error',modelUsage:{}}));process.exit(1);}
const answer=rule.answer??(id.startsWith('review-')?{verdict:'accept',summary:'Fixture acceptance',findings:[]}:id==='plan'?S.plan:{summary:'Fixture patch',files:[{path:'a.mjs',content:'export const a = 1;'}]});
const usage={inputTokens:40,outputTokens:10,cacheReadInputTokens:50,cacheCreationInputTokens:10,cacheCreationEphemeral1hInputTokens:10,cacheCreationEphemeral5mInputTokens:0,thinkingTokens:3,costUSD:0.001};
const modelUsage={[rule.servedModel||model]:usage};
if(rule.auxTokens)modelUsage['claude-haiku-5-5']={inputTokens:rule.auxTokens,outputTokens:0,cacheReadInputTokens:0,cacheCreationInputTokens:0,costUSD:0.0001};
console.log(JSON.stringify({type:'result',subtype:'success',is_error:false,stop_reason:rule.stopReason||'end_turn',structured_output:answer,total_cost_usd:0.001,modelUsage,...(rule.result||{})}));
`,
    { mode: 0o700 },
  );
  return {
    root,
    cli,
    job: path.join(root, "job.json"),
    out: path.join(root, "run"),
    calls: async () =>
      (await fs.readFile(log, "utf8"))
        .trim()
        .split("\n")
        .map((l) => JSON.parse(l)),
  };
}

test("mock CLI pipeline writes candidate, passes real check, then reviews", async () => {
  const f = await fixture();
  await run(f.job, { claude: f.cli, out: f.out });
  const r = await json(path.join(f.out, "receipt.json"));
  assert.equal(r.status, "accepted");
  assert.equal(r.provider, "anthropic");
  assert.equal(r.calls.length, 2);
  assert.deepEqual(
    r.calls.map((c) => [c.role, c.modelRequested, c.modelReported]),
    [
      ["planner", OPUS, OPUS],
      ["reviewer", OPUS, OPUS],
    ],
  );
  assert.equal(r.calls[0].price.kind, "standard-equivalent");
  assert.equal(r.calls[0].usage.input_tokens, 100);
  assert.equal(r.checks[0].passed, true);
  assert.ok(r.outputHashes["a.mjs"]);
  assert.deepEqual(r.escalations, []);
  assert.ok(
    (await fs.readFile(path.join(f.out, "report.html"), "utf8")).includes(
      "Fixture",
    ) === false,
  );
});

test("headless calls disable tools, settings, MCP, skills and persistence and pin model/effort", async () => {
  const f = await fixture();
  await run(f.job, { claude: f.cli, out: f.out });
  const [first] = await f.calls();
  const a = first.args,
    after = (flag) => a[a.indexOf(flag) + 1];
  assert.equal(a[0], "-p");
  assert.equal(after("--model"), OPUS);
  assert.equal(after("--effort"), "medium");
  assert.equal(after("--tools"), "");
  assert.equal(after("--setting-sources"), "");
  assert.equal(after("--output-format"), "json");
  for (const flag of [
    "--strict-mcp-config",
    "--disable-slash-commands",
    "--no-session-persistence",
  ])
    assert.ok(a.includes(flag), flag);
  assert.equal(JSON.parse(after("--json-schema")).type, "object");
  assert.equal(a.includes("--fallback-model"), false);
  assert.equal(first.cache, "1");
});

test("prompt caching can be re-enabled per job and is recorded", async () => {
  const f = await fixture();
  const j = await json(f.job);
  j.promptCaching = "cli-default";
  await save(f.job, j);
  await run(f.job, { claude: f.cli, out: f.out });
  assert.equal((await f.calls())[0].cache, process.env.DISABLE_PROMPT_CACHING ?? null);
  assert.equal((await json(path.join(f.out, "receipt.json"))).promptCaching, "cli-default");
  j.promptCaching = "on";
  await save(f.job, j);
  await assert.rejects(() => run(f.job, { claude: f.cli, out: f.out + "-2" }), /promptCaching/);
});

test("failed real check prevents expensive review and leaves failed receipt", async () => {
  const f = await fixture({ checks: [["node", "-e", "process.exit(2)"]] });
  await assert.rejects(
    () => run(f.job, { claude: f.cli, out: f.out }),
    /Repair limit/,
  );
  const r = await json(path.join(f.out, "receipt.json"));
  assert.equal(r.status, "failed");
  assert.equal(r.calls.length, 1);
  assert.equal(r.checks[0].passed, false);
});

test("changed validation contract cannot be accepted", async () => {
  const f = await fixture({
    checks: [
      ["node", "-e", "require('fs').writeFileSync('CONTRACT.md','tampered')"],
    ],
  });
  await assert.rejects(
    () => run(f.job, { claude: f.cli, out: f.out }),
    /Read-only contract changed/,
  );
  const r = await json(path.join(f.out, "receipt.json"));
  assert.equal(r.status, "failed");
  assert.equal(r.calls.length, 1);
});

test("dry run makes no model calls, reused output directory is rejected", async () => {
  const f = await fixture();
  await run(f.job, { claude: "/does/not/exist", out: f.out, dryRun: true });
  assert.equal(
    (await json(path.join(f.out, "receipt.json"))).status,
    "dry-run",
  );
  await assert.rejects(
    () => run(f.job, { out: f.out, dryRun: true }),
    /already used/,
  );
});

test("team: Sonnet worker output that violates ownership is retried once on Opus and recorded", async () => {
  const f = await fixture({
    mode: "team",
    maxCalls: 4,
    rules: [
      {
        id: "^one$",
        model: SONNET,
        answer: {
          summary: "wrong owner",
          files: [{ path: "b.mjs", content: "x" }],
        },
      },
    ],
  });
  await run(f.job, { claude: f.cli, out: f.out });
  const r = await json(path.join(f.out, "receipt.json"));
  assert.equal(r.status, "accepted");
  assert.deepEqual(
    r.calls.map((c) => [c.id, c.role, c.modelRequested]),
    [
      ["plan", "planner", OPUS],
      ["one", "worker", SONNET],
      ["one-escalated", "escalation", OPUS],
      ["review-0", "reviewer", OPUS],
    ],
  );
  assert.equal(r.calls[2].escalatedFrom, SONNET);
  assert.equal(r.escalations.length, 1);
  assert.match(r.escalations[0].reason, /^unusable-output/);
});

test("truncated worker output escalates; the same failure without an escalation lane fails as before", async () => {
  const rules = [{ id: "^one$", model: SONNET, stopReason: "max_tokens" }];
  const f = await fixture({ mode: "team", maxCalls: 4, rules });
  await run(f.job, { claude: f.cli, out: f.out });
  assert.equal(
    (await json(path.join(f.out, "receipt.json"))).escalations.length,
    1,
  );
  const g = await fixture({ mode: "team", maxCalls: 4, rules, escalation: false });
  await assert.rejects(() => run(g.job, { claude: g.cli, out: g.out }), /truncated/);
  const r = await json(path.join(g.out, "receipt.json"));
  assert.equal(r.status, "failed");
  assert.deepEqual(r.escalations, []);
});

test("authentication or transport errors are never escalated to another model", async () => {
  const f = await fixture({
    mode: "team",
    maxCalls: 4,
    rules: [{ id: "^one$", model: SONNET, authError: true }],
  });
  await assert.rejects(() => run(f.job, { claude: f.cli, out: f.out }), /one failed/);
  const r = await json(path.join(f.out, "receipt.json"));
  assert.equal(r.status, "failed");
  assert.deepEqual(r.escalations, []);
  assert.equal(r.calls.length, 2);
});

test("a call served by a different model than requested is rejected", async () => {
  const f = await fixture({
    mode: "team",
    maxCalls: 4,
    rules: [{ id: "^one$", servedModel: "claude-haiku-5-5" }],
  });
  await assert.rejects(
    () => run(f.job, { claude: f.cli, out: f.out }),
    /not served by the requested model/,
  );
  assert.deepEqual(
    (await json(path.join(f.out, "receipt.json"))).escalations,
    [],
  );
});

test("repeated validation failure after a Sonnet repair moves only the next repair to Opus", async () => {
  const f = await fixture({
    mode: "team",
    maxCalls: 6,
    maxRepairs: 2,
    checks: [
      [
        "node",
        "-e",
        "process.exit(require('fs').readFileSync('a.mjs','utf8').includes('= 2')?0:1)",
      ],
    ],
    rules: [
      {
        id: "repair",
        model: OPUS,
        answer: {
          summary: "fixed",
          files: [{ path: "a.mjs", content: "export const a = 2;" }],
        },
      },
    ],
  });
  await run(f.job, { claude: f.cli, out: f.out });
  const r = await json(path.join(f.out, "receipt.json"));
  assert.equal(r.status, "accepted");
  assert.deepEqual(
    r.calls.map((c) => [c.id, c.modelRequested]),
    [
      ["plan", OPUS],
      ["one", SONNET],
      ["one-repair-1", SONNET],
      ["one-repair-2", OPUS],
      ["review-2", OPUS],
    ],
  );
  assert.equal(r.escalations.length, 1);
  assert.match(r.escalations[0].reason, /^repeated-failure/);
});

test("escalation never exceeds the call budget", async () => {
  const f = await fixture({
    mode: "team",
    maxCalls: 3,
    rules: [{ id: "^one$", model: SONNET, stopReason: "max_tokens" }],
  });
  // plan + one + one-escalated uses all three calls; review cannot be admitted.
  await assert.rejects(
    () => run(f.job, { claude: f.cli, out: f.out }),
    /Admission budget reached/,
  );
  const r = await json(path.join(f.out, "receipt.json"));
  assert.equal(r.calls.length, 3);
});

test("an escalation that the budget cannot admit is neither run nor recorded", async () => {
  const f = await fixture({
    mode: "team",
    maxCalls: 4,
    // The truncated call also pushes observed tokens past stopAfterTokens (1000).
    rules: [{ id: "^one$", model: SONNET, stopReason: "max_tokens", auxTokens: 1000 }],
  });
  await assert.rejects(() => run(f.job, { claude: f.cli, out: f.out }), /truncated/);
  const r = await json(path.join(f.out, "receipt.json"));
  assert.deepEqual(r.escalations, []);
  assert.equal(r.calls.length, 2);
});

test("executed escalations link to the call that ran them", async () => {
  const f = await fixture({
    mode: "team",
    maxCalls: 4,
    rules: [{ id: "^one$", model: SONNET, stopReason: "max_tokens" }],
  });
  await run(f.job, { claude: f.cli, out: f.out });
  const [e] = (await json(path.join(f.out, "receipt.json"))).escalations;
  assert.equal(e.executed, true);
  assert.equal(e.call, "one-escalated");
});

test("a schema-retry failure from the CLI is unusable output and escalates", async () => {
  const f = await fixture({
    mode: "team",
    maxCalls: 4,
    rules: [{ id: "^one$", model: SONNET, result: { is_error: true, subtype: "error_max_structured_output_retries", structured_output: undefined } }],
  });
  await run(f.job, { claude: f.cli, out: f.out });
  assert.match((await json(path.join(f.out, "receipt.json"))).escalations[0].reason, /no schema-valid answer/);
});

test("is_error with exit code 0 and non-JSON output fail closed without escalation", async () => {
  for (const rule of [
    { id: "^one$", model: SONNET, result: { is_error: true, result: "API Error: 529" } },
    { id: "^one$", model: SONNET, raw: "not json" },
  ]) {
    const f = await fixture({ mode: "team", maxCalls: 4, rules: [rule] });
    await assert.rejects(() => run(f.job, { claude: f.cli, out: f.out }), /one failed/);
    assert.deepEqual((await json(path.join(f.out, "receipt.json"))).escalations, []);
  }
});

test("auxiliary host-model tokens count toward stopAfterTokens", async () => {
  // Each call uses 110 requested-model tokens plus 1000 auxiliary tokens; the budget is 1000.
  const f = await fixture({ rules: [{ id: ".", auxTokens: 1000 }] });
  await assert.rejects(
    () => run(f.job, { claude: f.cli, out: f.out }),
    /Admission budget reached/,
  );
  const r = await json(path.join(f.out, "receipt.json"));
  assert.equal(r.calls.length, 1);
  assert.equal(r.calls[0].auxiliary[0].model, "claude-haiku-5-5");
});
