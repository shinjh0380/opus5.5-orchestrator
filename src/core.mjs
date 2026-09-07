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
  for (const role of ["planner", "worker", "reviewer"])
    if (
      !j.models?.[role] ||
      !/^[a-z0-9.-]+$/.test(j.models[role].model) ||
      !["low", "medium", "high", "xhigh", "max"].includes(j.models[role].effort)
    )
      throw new Error(`Invalid model lane ${role}`);
  return j;
}
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
export const rates = {
  "gpt-6-astra": { input: 10, cached: 1, write: 12.5, output: 50 },
  "gpt-5.6-luna": { input: 0.2, cached: 0.02, write: 0.25, output: 1.2 },
  "gpt-5.6-sol": { input: 4, cached: 0.4, write: 5, output: 20 },
  "gpt-5.6-terra": { input: 2, cached: 0.2, write: 2.5, output: 12 },
};
export function estimate(model, u) {
  const r = rates[model];
  if (!r)
    return { kind: "unavailable", reason: "No verified price for this model" };
  const i = u?.input_tokens,
    c = u?.cached_input_tokens,
    o = u?.output_tokens,
    w = u?.cache_write_input_tokens;
  if (![i, c, o].every((n) => Number.isSafeInteger(n) && n >= 0) || c > i)
    return { kind: "unavailable", reason: "Missing or inconsistent usage" };
  if (i > 272000)
    return {
      kind: "unavailable",
      reason:
        "Aggregate input exceeds short-context threshold; request-level context sizes required",
    };
  if (w !== undefined && (!Number.isSafeInteger(w) || w < 0 || w + c > i))
    return { kind: "unavailable", reason: "Invalid cache-write count" };
  const base = ((i - c) * r.input + c * r.cached + o * r.output) / 1e6;
  return w === undefined
    ? {
        kind: "range",
        min: base,
        max: base + ((i - c) * (r.write - r.input)) / 1e6,
        reason: "Cache-write telemetry absent",
      }
    : {
        kind: "standard-equivalent",
        usd: base + (w * (r.write - r.input)) / 1e6,
      };
}
export function summarize(events) {
  const usages = events
    .filter((e) => e.type === "turn.completed")
    .map((e) => e.usage);
  if (!usages.length) return null;
  const fields = [
    "input_tokens",
    "cached_input_tokens",
    "cache_write_input_tokens",
    "output_tokens",
    "reasoning_output_tokens",
  ];
  const total = {};
  for (const f of fields)
    if (usages.every((u) => Number.isSafeInteger(u?.[f])))
      total[f] = usages.reduce((n, u) => n + u[f], 0);
  return total;
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
