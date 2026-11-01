import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {installNative} from '../plugins/astra-orchestrator/scripts/install-native.mjs';
const fixture=async t=>{const p=await fs.mkdtemp(path.join(os.tmpdir(),'astra-native-test-'));t.after(()=>fs.rm(p,{recursive:true,force:true}));return p;};

test('native setup installs a discoverable skill and pinned roles while preserving project config',async t=>{
 const p=await fixture(t);await fs.mkdir(path.join(p,'.claude'));await fs.writeFile(path.join(p,'.claude/settings.json'),'{"model":"existing-model"}\n');
 const dry=await installNative(p,{dryRun:true});assert.equal(dry.mode,'dry-run');assert.deepEqual(await fs.readdir(p),['.claude']);assert.deepEqual(await fs.readdir(path.join(p,'.claude')),['settings.json']);
 await installNative(p);assert.equal((await installNative(p,{check:true})).mode,'check');
 assert.equal(await fs.readFile(path.join(p,'.claude/settings.json'),'utf8'),'{"model":"existing-model"}\n');
 assert.match(await fs.readFile(path.join(p,'.claude/skills/astra-orchestrator/SKILL.md'),'utf8'),/^---\r?\nname: astra-orchestrator/);
 const again=await installNative(p);assert.ok(again.files.every(f=>f.action==='unchanged'));
});
test('roles-only install does not duplicate the plugin skill',async t=>{
 const p=await fixture(t);await installNative(p,{rolesOnly:true});assert.equal((await installNative(p,{rolesOnly:true,check:true})).files.length,2);
 await assert.rejects(fs.access(path.join(p,'.claude/skills')),e=>e.code==='ENOENT');
});
test('modified profile stops before a missing second role is recreated',async t=>{
 const p=await fixture(t);await installNative(p);const first=path.join(p,'.claude/agents/astra-worker.md'),second=path.join(p,'.claude/agents/astra-review.md');
 await fs.writeFile(first,'user customization\n');await fs.rm(second);
 await assert.rejects(installNative(p),/Refusing modified/);assert.equal(await fs.readFile(first,'utf8'),'user customization\n');await assert.rejects(fs.access(second),e=>e.code==='ENOENT');
});
test('a linked skill destination is rejected before any role is installed',async t=>{
 const p=await fixture(t),outside=await fixture(t);await fs.mkdir(path.join(p,'.claude'));await fs.symlink(outside,path.join(p,'.claude/skills'),'dir');
 await assert.rejects(installNative(p),/symlink/);assert.deepEqual(await fs.readdir(outside),[]);await assert.rejects(fs.access(path.join(p,'.claude/agents')),e=>e.code==='ENOENT');
});
test('unmanaged conflicting roles and malformed manifests are refused',async t=>{
 const p=await fixture(t);await fs.mkdir(path.join(p,'.claude/agents'),{recursive:true});await fs.writeFile(path.join(p,'.claude/agents/astra-review.md'),'custom');
 await assert.rejects(installNative(p),/unmanaged/);
 await fs.writeFile(path.join(p,'.claude/astra-orchestrator-install.json'),'{}');await assert.rejects(installNative(p),/Invalid existing install manifest/);
});
test('installed subagents pin Claude models and effort; no legacy model remains',async t=>{
 const p=await fixture(t);await installNative(p);
 const worker=await fs.readFile(path.join(p,'.claude/agents/astra-worker.md'),'utf8'),review=await fs.readFile(path.join(p,'.claude/agents/astra-review.md'),'utf8');
 const front=s=>Object.fromEntries(s.split('---')[1].trim().split('\n').map(l=>{const i=l.indexOf(':');return [l.slice(0,i).trim(),l.slice(i+1).trim()];}));
 assert.deepEqual([front(worker).name,front(worker).model,front(worker).effort],['astra-worker','claude-sonnet-5-5','medium']);
 assert.deepEqual([front(review).name,front(review).model,front(review).effort],['astra-review','claude-opus-5-5','medium']);
 assert.equal(front(review).tools,'Read, Grep, Glob, Bash');
 for(const file of [worker,review,await fs.readFile(path.join(p,'.claude/skills/astra-orchestrator/SKILL.md'),'utf8')])assert.doesNotMatch(file,/gpt-|luna|codex/i);
});
