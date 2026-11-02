#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const plugin=path.resolve(import.meta.dirname,'..');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const manifestPath='.claude/opus-orchestrator-install.json';
const exists=async p=>{try{return await fs.lstat(p)}catch(e){if(e.code==='ENOENT')return null;throw e;}};

async function inspect(root,relative){
 let current=root;
 const parts=relative.split('/');
 for(let i=0;i<parts.length;i++){
  current=path.join(current,parts[i]);const stat=await exists(current);
  if(!stat) return null;
  if(stat.isSymbolicLink())throw Error('Refusing symlink destination: '+relative);
  if(i<parts.length-1&&!stat.isDirectory())throw Error('Expected directory: '+current);
  if(i===parts.length-1&&!stat.isFile())throw Error('Expected regular file: '+relative);
 }
 return fs.readFile(current);
}

async function collect(dir,prefix=''){
 const files=[];
 for(const item of await fs.readdir(dir,{withFileTypes:true})){
  const rel=prefix+item.name;
  if(item.isSymbolicLink())throw Error('Plugin source contains a symlink: '+rel);
  if(item.isDirectory())files.push(...await collect(path.join(dir,item.name),rel+'/'));
  else if(item.isFile())files.push(rel);
 }
 return files.sort();
}

export async function installNative(project,{rolesOnly=false,dryRun=false,check=false}={}){
 if(!project)throw Error('Specify an existing target project with --project');
 const requested=path.resolve(project),stat=await fs.lstat(requested);
 if(!stat.isDirectory()||stat.isSymbolicLink())throw Error('Project must be a real directory');
 const root=await fs.realpath(requested),selected=[];
 for(const name of ['opus-worker.md','opus-review.md'])selected.push({from:path.join(plugin,'agents',name),to:'.claude/agents/'+name});
 if(!rolesOnly){const src=path.join(plugin,'skills/opus-orchestrator');for(const rel of await collect(src))selected.push({from:path.join(src,rel),to:'.claude/skills/opus-orchestrator/'+rel});}
 const previousBytes=await inspect(root,manifestPath);
 const previous=previousBytes?JSON.parse(previousBytes):{version:1,files:{}};
 if(previous.version!==1||!previous.files||typeof previous.files!=='object'||Array.isArray(previous.files))throw Error('Invalid existing install manifest');
 const operations=[];
 for(const file of selected){
  const content=await fs.readFile(file.from),old=await inspect(root,file.to),expected=hash(content);
  const same=old&&hash(old)===expected;
  if(old&&!same&&previous.files[file.to]!==hash(old))throw Error('Refusing modified or unmanaged file: '+file.to);
  operations.push({...file,content,expected,before:old?hash(old):null,action:same?'unchanged':old?'update':'create'});
 }
 if(check){const missing=operations.filter(o=>o.action!=='unchanged');if(missing.length)throw Error('Installation differs: '+missing.map(o=>o.to).join(', '));return {mode:'check',project:root,files:operations.map(o=>({path:o.to,action:o.action}))};}
 if(dryRun)return {mode:'dry-run',project:root,files:operations.map(o=>({path:o.to,action:o.action}))};
 // Preflight every destination before making any changes. Recheck each file at write time.
 for(const o of operations){
  if(o.action==='unchanged')continue;
  const now=await inspect(root,o.to);if((now?hash(now):null)!==o.before)throw Error('Destination changed during install: '+o.to);
  const target=path.join(root,o.to);await fs.mkdir(path.dirname(target),{recursive:true});
  await inspect(root,o.to);
  const temp=target+'.'+crypto.randomUUID()+'.tmp';
  try{await fs.writeFile(temp,o.content,{flag:'wx'});await fs.rename(temp,target);}finally{await fs.rm(temp,{force:true});}
 }
 const record={version:1,plugin:'opus-orchestrator',files:{...previous.files,...Object.fromEntries(operations.map(o=>[o.to,o.expected]))}};
 const target=path.join(root,manifestPath);await fs.mkdir(path.dirname(target),{recursive:true});
 const currentManifest=await inspect(root,manifestPath);
 if((currentManifest?hash(currentManifest):null)!==(previousBytes?hash(previousBytes):null))throw Error('Install manifest changed concurrently; rerun after resolving the other install');
 await fs.writeFile(target,JSON.stringify(record,null,2)+'\n');
 for(const o of operations)if(hash(await inspect(root,o.to))!==o.expected)throw Error('Post-install verification failed: '+o.to);
 return {mode:'installed',project:root,files:operations.map(o=>({path:o.to,action:o.action})),next:'Start a new Claude Code session in the project, select claude-opus-5-5 (/model), and invoke /opus-orchestrator.'};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const args=process.argv.slice(2),options={};let project;
  for(let i=0;i<args.length;i++){
   if(args[i]==='--project'&&args[i+1]&&!args[i+1].startsWith('--'))project=args[++i];
   else if(args[i]==='--roles-only')options.rolesOnly=true;
   else if(args[i]==='--dry-run')options.dryRun=true;
   else if(args[i]==='--check')options.check=true;
   else throw Error('Usage: install-native.mjs --project DIR [--roles-only] [--dry-run | --check]');
  }
  if(options.check&&options.dryRun)throw Error('Choose --check or --dry-run');
  console.log(JSON.stringify(await installNative(project,options),null,2));
 }catch(e){console.error(e.message);process.exitCode=1;}
}
