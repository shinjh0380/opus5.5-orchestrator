#!/usr/bin/env node
import path from "node:path";
import { run, apply } from "../src/runner.mjs";
const [cmd, file, ...rest] = process.argv.slice(2);
const usage =
  "opus-orchestrator run job.json [--out directory] [--claude binary] [--dry-run]\nopus-orchestrator apply run-directory target-directory";
try {
  if (cmd === "run" && file) {
    const opts = {};
    for (let i = 0; i < rest.length; i++) {
      if (rest[i] === "--dry-run") opts.dryRun = true;
      else if (rest[i] === "--codex")
        throw new Error(
          "--codex was removed: the runner now calls Claude. Use --claude /path/to/claude or CLAUDE_BIN.",
        );
      else if (["--out", "--claude"].includes(rest[i]) && rest[i + 1]) {
        const key = rest[i].slice(2);
        opts[key] = rest[++i];
      } else throw new Error(usage);
    }
    await run(path.resolve(file), opts);
  } else if (cmd === "apply" && file && rest.length === 1)
    await apply(path.resolve(file), path.resolve(rest[0]));
  else {
    console.log(usage);
    if (cmd && cmd !== "--help") process.exitCode = 1;
  }
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
