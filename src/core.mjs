import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export const sha = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");
export const json = async (file) => JSON.parse(await fs.readFile(file, "utf8"));
export const save = async (file, value) => {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(value, null, 2) + "\n");
};
export function relativeFile(value) {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9_][A-Za-z0-9_./-]*$/.test(value) ||
    path.posix.isAbsolute(value) ||
    value
      .split("/")
      .some((p) => !p || p === ".." || p === "." || p.startsWith(".")) ||
    value.includes("\\")
  )
    throw new Error(`Unsafe file path: ${value}`);
  return value;
}
export async function safeRead(root, file) {
  relativeFile(file);
  const canonicalRoot = await fs.realpath(root);
  let current = canonicalRoot;
  for (const part of file.split("/")) {
    current = path.join(current, part);
    const stat = await fs.lstat(current);
    if (stat.isSymbolicLink()) throw new Error(`Symlink denied: ${file}`);
  }
  if (!current.startsWith(canonicalRoot + path.sep))
    throw new Error("Path escaped root");
  const stat = await fs.stat(current);
  if (!stat.isFile() || stat.size > 150000)
    throw new Error(`Invalid context file: ${file}`);
  return fs.readFile(current, "utf8");
}
export function validateJob(j) {
  if (j.mode !== undefined && !["team", "solo"].includes(j.mode))
    throw new Error("Mode must be team or solo");
  if (
    !j ||
    typeof j.goal !== "string" ||
    !j.goal.trim() ||
    j.goal.length > 12000
  )
    throw new Error("A bounded goal is required");
  for (const k of ["context", "outputs"])
    if (
      !Array.isArray(j[k]) ||
      !j[k].length ||
      j[k].length > 30 ||
      new Set(j[k]).size !== j[k].length
    )
      throw new Error(`Invalid ${k}`);
    else j[k].forEach(relativeFile);
  if (
    !Array.isArray(j.checks) ||
    !j.checks.length ||
    j.checks.some(
      (c) =>
        !Array.isArray(c) ||
        !c.length ||
        c.some((a) => typeof a !== "string" || !a),
    )
  )
    throw new Error("Checks must be explicit argv arrays");
  for (const [key, min, max] of [
    ["maxWorkers", 1, 4],
    ["maxCalls", 3, 20],
    ["maxRepairs", 0, 2],
    ["maxPromptChars", 5000, 120000],
    ["stopAfterTokens", 1000, 10000000],
    ["timeoutSeconds", 10, 1800],
  ])
    if (!Number.isInteger(j[key]) || j[key] < min || j[key] > max)
      throw new Error(`Invalid ${key}`);
  if (
    j.promptCaching !== undefined &&
    !["off", "cli-default"].includes(j.promptCaching)
  )
    throw new Error("promptCaching must be off or cli-default");
  // The optional escalation lane is used only by the recorded escalation policy in runner.mjs.
  for (const role of ["planner", "worker", "reviewer", "escalation"]) {
    if (role === "escalation" && j.models?.escalation === undefined) continue;
    const lane = j.models?.[role];
    if (lane && LEGACY_MODEL.test(String(lane.model)))
      throw new Error(
        `Model lane ${role} uses legacy model ${lane.model}; this runner calls Claude (see docs/migration-claude.md)`,
      );
    if (
      !lane ||
      !CLAUDE_MODEL.test(lane.model) ||
      !EFFORTS.includes(lane.effort)
    )
      throw new Error(`Invalid model lane ${role}`);
  }
  return j;
}
// Pinned, dated-or-dateless Claude model IDs only. Aliases such as "opus" move over time.
export const CLAUDE_MODEL = /^claude-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LEGACY_MODEL = /^gpt-/;
// Values accepted by `claude --effort` and the Messages API effort parameter.
export const EFFORTS = ["low", "medium", "high", "xhigh", "max"];
export function validatePlan(plan, j) {
  if (
    !plan ||
    !Array.isArray(plan.tasks) ||
    !plan.tasks.length ||
    plan.tasks.length > j.maxWorkers
  )
    throw new Error("Planner exceeded worker count");
  const owners = new Set(),
    ids = new Set();
  for (const t of plan.tasks) {
    if (!/^[a-z][a-z0-9-]{0,39}$/.test(t.id) || ids.has(t.id))
      throw new Error("Invalid/duplicate task ID");
    ids.add(t.id);
    if (
      !t.objective ||
      !t.acceptance ||
      !Array.isArray(t.files) ||
      !t.files.length ||
      !Array.isArray(t.context)
    )
      throw new Error("Incomplete task contract");
    for (const f of t.files) {
      relativeFile(f);
      if (!j.outputs.includes(f) || owners.has(f))
        throw new Error(`Output ownership conflict: ${f}`);
      owners.add(f);
    }
    for (const f of t.context)
      if (!j.context.includes(f)) throw new Error(`Unlisted context: ${f}`);
  }
  if (j.outputs.some((f) => !owners.has(f)))
    throw new Error("Plan omitted an output");
  return plan;
}
export function validatePatch(patch, owned) {
  if (!Array.isArray(patch?.files) || patch.files.length !== owned.length)
    throw new Error("Patch must contain every owned file exactly once");
  const seen = new Set();
  for (const f of patch.files) {
    relativeFile(f.path);
    if (
      !owned.includes(f.path) ||
      seen.has(f.path) ||
      typeof f.content !== "string" ||
      Buffer.byteLength(f.content) > 150000
    )
      throw new Error(`Invalid patch: ${f.path}`);
    seen.add(f.path);
  }
  return patch;
}
// USD per million tokens, Claude API Standard (non-batch) list prices.
// write = 5-minute cache write, write1h = 1-hour cache write, cached = cache read.
// Neither model has a long-context surcharge across its 1M window.
export const pricing = {
  asOf: "2026-11-02",
  url: "https://platform.claude.com/docs/en/about-claude/pricing",
};
export const rates = {
  "claude-opus-5-5": {
    input: 4,
    cached: 0.2,
    write: 5,
    write1h: 8,
    output: 20,
  },
  "claude-sonnet-5-5": {
    input: 2,
    cached: 0.1,
    write: 2.5,
    write1h: 4,
    output: 10,
  },
};
// Usage is normalized so input_tokens is the TOTAL prompt size: uncached input plus
// cache reads plus cache writes. (The Claude API reports these three separately.)
export function estimate(model, u) {
  const r = rates[model];
  if (!r)
    return { kind: "unavailable", reason: "No verified price for this model" };
  const i = u?.input_tokens,
    c = u?.cached_input_tokens,
    o = u?.output_tokens,
    w = u?.cache_write_input_tokens,
    w1h = u?.cache_write_1h_input_tokens;
  if (![i, c, o].every((n) => Number.isSafeInteger(n) && n >= 0) || c > i)
    return { kind: "unavailable", reason: "Missing or inconsistent usage" };
  if (r.longContextAbove && i > r.longContextAbove)
    return {
      kind: "unavailable",
      reason:
        "Aggregate input exceeds the standard-rate threshold; request-level context sizes required",
    };
  if (w !== undefined && (!Number.isSafeInteger(w) || w < 0 || w + c > i))
    return { kind: "unavailable", reason: "Invalid cache-write count" };
  if (w1h !== undefined && (!Number.isSafeInteger(w1h) || w1h < 0 || w1h > w))
    return { kind: "unavailable", reason: "Invalid 1-hour cache-write count" };
  const base = ((i - c) * r.input + c * r.cached + o * r.output) / 1e6;
  if (w === undefined)
    return {
      kind: "range",
      min: base,
      max: base + ((i - c) * (r.write1h - r.input)) / 1e6,
      reason: "Cache-write telemetry absent",
    };
  const premium5m = r.write - r.input,
    premium1h = r.write1h - r.input;
  if (w1h === undefined)
    return {
      kind: "range",
      min: base + (w * premium5m) / 1e6,
      max: base + (w * premium1h) / 1e6,
      reason: "Cache-write duration telemetry absent",
    };
  return {
    kind: "standard-equivalent",
    usd: base + ((w - w1h) * premium5m + w1h * premium1h) / 1e6,
  };
}
const count = (n) => (Number.isSafeInteger(n) && n >= 0 ? n : undefined);
// Normalize one `claude -p --output-format json` result entry for one model.
export function normalizeModelUsage(m) {
  const input = count(m?.inputTokens),
    read = count(m?.cacheReadInputTokens),
    write = count(m?.cacheCreationInputTokens),
    output = count(m?.outputTokens);
  if ([input, read, write, output].includes(undefined)) return null;
  const u = {
    input_tokens: input + read + write,
    cached_input_tokens: read,
    cache_write_input_tokens: write,
    output_tokens: output,
  };
  const w1h = count(m.cacheCreationEphemeral1hInputTokens),
    w5m = count(m.cacheCreationEphemeral5mInputTokens);
  if (w1h !== undefined && w5m !== undefined && w1h + w5m === write)
    u.cache_write_1h_input_tokens = w1h;
  // Thinking is billed as output and is already included in outputTokens.
  if (count(m.thinkingTokens) !== undefined)
    u.reasoning_output_tokens = m.thinkingTokens;
  return u;
}
// Split a CLI result into the requested model's usage and any auxiliary host-model usage.
// Returns null when the requested model did not serve the call (never a silent substitution).
export function summarize(result, requestedModel) {
  const per = result?.modelUsage;
  if (!per || typeof per !== "object") return null;
  const served = Object.entries(per).find(
    ([name, m]) => name === requestedModel || m?.canonicalModel === requestedModel,
  );
  if (!served) return null;
  const usage = normalizeModelUsage(served[1]);
  if (!usage) return null;
  const auxiliary = Object.entries(per)
    .filter(([name]) => name !== served[0])
    .map(([name, m]) => ({
      model: name,
      usage: normalizeModelUsage(m),
      reportedCostUsd: Number.isFinite(m?.costUSD) ? m.costUSD : null,
    }));
  return { usage, auxiliary, servedModel: served[0] };
}
export const objectSchema = (properties) => ({
  type: "object",
  additionalProperties: false,
  properties,
  required: Object.keys(properties),
});
const string = { type: "string" },
  strings = { type: "array", items: string };
export const planSchema = objectSchema({
  rationale: string,
  tasks: {
    type: "array",
    items: objectSchema({
      id: string,
      objective: string,
      files: strings,
      context: strings,
      acceptance: string,
    }),
  },
});
export const patchSchema = objectSchema({
  summary: string,
  files: {
    type: "array",
    items: objectSchema({ path: string, content: string }),
  },
});
export const reviewSchema = objectSchema({
  verdict: { type: "string", enum: ["accept", "fix"] },
  summary: string,
  findings: {
    type: "array",
    items: objectSchema({ file: string, issue: string, fix: string }),
  },
});
export function scopePlanSchema(job) {
  const schema = JSON.parse(JSON.stringify(planSchema));
  const p = schema.properties.tasks.items.properties;
  p.context = { type: "array", items: { type: "string", enum: job.context } };
  p.files = { type: "array", items: { type: "string", enum: job.outputs } };
  return schema;
}
