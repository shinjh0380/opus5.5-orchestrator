import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { calculateCost, RATES, breakEvenReuse } from './calculator.mjs';
import { buildCsv, escapeCsv } from './export.mjs';

test('escapeCsv quotes commas, quotes, and line breaks', () => {
  assert.equal(escapeCsv('plain'), 'plain');
  assert.equal(escapeCsv('a,b'), '"a,b"');
  assert.equal(escapeCsv('a"b'), '"a""b"');
  assert.equal(escapeCsv('a\r\nb'), '"a\r\nb"');
});

test('buildCsv emits a UTF-8 BOM, header, CRLF rows, and the full breakdown', () => {
  const csv = buildCsv(
    { model: 'astra', input: 100000, cached: 80000, write: 0, output: 2000 },
    { ordinaryInput: 20000, ordinaryInputCost: 0.2, cachedCost: 0.08, writeCost: 0, outputCost: 0.1, totalCost: 0.38, cacheHitRate: 0.8 },
  );
  assert.equal(csv, '\uFEFFmodel,input,cached,write,output,ordinaryInput,ordinaryInputCost,cachedCost,writeCost,outputCost,totalCost,cacheHitRate\r\nastra,100000,80000,0,2000,20000,0.2,0.08,0,0.1,0.38,0.8\r\n');
});

function makeElement(id, value = '') {
  return { id, value, textContent: '', innerHTML: '', style: {}, listeners: new Map(), addEventListener(type, listener) { this.listeners.set(type, listener); }, click() { this.listeners.get('click')?.(); } };
}

test('the page exports changed click-time values and blocks invalid values', () => {
  const ids = ['model', 'input', 'cached', 'write', 'output', 'total', 'breakdown', 'error', 'cache-share', 'reuse-explanation', 'bar-ordinary', 'bar-cached', 'bar-write', 'bar-output', 'export-csv', 'preset-warm', 'preset-cold', 'preset-plain'];
  const elements = Object.fromEntries(ids.map(id => [id, makeElement(id)]));
  elements.model.value = 'astra';
  elements.input.value = '100000'; elements.cached.value = '80000'; elements.write.value = '0'; elements.output.value = '2000';
  const downloads = [];
  const context = {
    RATES, calculateCost, breakEvenReuse, buildCsv,
    document: { getElementById(id) { return elements[id]; }, createElement() { return { href: '', download: '', click() { downloads.push(this); } }; } },
    URL: { createObjectURL(blob) { return `blob:${downloads.length}:${blob.parts[0]}`; }, revokeObjectURL() {} },
    Blob: class { constructor(parts, options) { this.parts = parts; this.options = options; } }, setTimeout,
  };
  const source = fs.readFileSync('index.html', 'utf8').match(/<script type="module">([\s\S]*?)<\/script>/)[1]
    .replace("import { RATES, calculateCost, breakEvenReuse } from './calculator.mjs';", '')
    .replace("import { buildCsv } from './export.mjs';", '');
  vm.runInNewContext(source, context);
  elements.input.value = '123456';
  elements['export-csv'].click();
  assert.equal(downloads.length, 1);
  assert.match(downloads[0].href, /123456,80000/);
  assert.equal(downloads[0].download, 'cache-lab.csv');
  elements.input.value = '';
  elements['export-csv'].click();
  assert.equal(downloads.length, 1);
  assert.match(elements.error.textContent, /모든 토큰 수를 입력/);
});
