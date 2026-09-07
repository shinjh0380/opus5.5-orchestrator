import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {calculateCost,breakEvenReuse,RATES} from './calculator.mjs';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
test('Astra warm: cached input is a subset, output counted once',()=>{
  const c=calculateCost({model:'astra',input:100000,cached:80000,write:0,output:2000});
  assert.equal(c.ordinaryInput,20000);close(c.inputCost,.28);close(c.outputCost,.1);close(c.totalCost,.38);close(c.cacheHitRate,.8);
});
test('cache writes replace ordinary input instead of adding 125% twice',()=>{
  const c=calculateCost({model:'astra',input:100000,cached:0,write:100000,output:2000});close(c.totalCost,1.35);
});
test('Luna same token mix uses its own prices',()=>close(calculateCost({model:'luna',input:100000,cached:80000,write:0,output:2000}).totalCost,.008));
test('mixed reads+writes+ordinary',()=>{const c=calculateCost({model:'astra',input:10000,cached:4000,write:2000,output:100});assert.equal(c.ordinaryInput,4000);close(c.totalCost,.074);});
test('zero input and nonzero output',()=>{const c=calculateCost({model:'astra',input:0,cached:0,write:0,output:10});assert.equal(c.cacheHitRate,0);close(c.totalCost,.0005);});
test('reject negative, fractional, nonfinite, string and missing counts',()=>{
  for(const value of [-1,.5,Infinity,NaN,'1',undefined,Number.MAX_SAFE_INTEGER+1]) for(const field of ['input','cached','write','output']) assert.throws(()=>calculateCost({model:'astra',input:10,cached:0,write:0,output:0,[field]:value}));
});
test('reject overlapping subsets and long context',()=>{assert.throws(()=>calculateCost({model:'astra',input:10,cached:8,write:3,output:0}));assert.throws(()=>calculateCost({model:'astra',input:272001,cached:0,write:0,output:0}));});
test('model keys do not accept prototype properties',()=>{for(const model of ['unknown','toString','constructor','__proto__']){assert.throws(()=>calculateCost({model,input:0,cached:0,write:0,output:0}));assert.throws(()=>breakEvenReuse(model));}});
test('one reuse beats two ordinary reads',()=>{for(const model of ['astra','luna'])assert.equal(breakEvenReuse(model),1);assert.equal(RATES.astra.write,12.5);assert.equal(RATES.luna.output,1.2);});
test('hundred deterministic mixed cases follow the declared rates',()=>{
  for(let n=1;n<=100;n++){const input=n*123,cached=n*40,write=n*20,output=n*3;const c=calculateCost({model:'astra',input,cached,write,output});close(c.totalCost,((input-cached-write)*10+cached+write*12.5+output*50)/1e6);}
});
test('UI includes required accessible controls and local module',()=>{
  const html=fs.readFileSync('index.html','utf8');for(const id of ['model','input','cached','write','output','total','breakdown','error','preset-warm','preset-cold','preset-plain'])assert.match(html,new RegExp('id=["\x27]'+id+'["\x27]'));
  assert.match(html,/calculator\.mjs/);assert.match(html,/aria-live/);assert.match(html,/developers\.openai\.com/);
});
