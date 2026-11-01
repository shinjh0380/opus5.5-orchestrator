import test from 'node:test';
import assert from 'node:assert/strict';
import {toCsv} from './csv.mjs';
test('plain rows preserve order with CRLF and no trailing delimiter',()=>assert.equal(toCsv([['name','city'],['Dante','Seoul']]),'name,city\r\nDante,Seoul'));
test('quotes, commas and newlines are escaped',()=>assert.equal(toCsv([['a,b','say "hi"','a\nb','a\rb']]),'"a,b","say ""hi""","a\nb","a\rb"'));
test('empty table and cells',()=>{assert.equal(toCsv([]),'');assert.equal(toCsv([['','']]),',');});
test('unicode strings are preserved',()=>assert.equal(toCsv([['단테','서울']]),'단테,서울'));
test('bad structures and numbers are rejected',()=>{for(const v of [null,{},[null],['row'],[[3]],[[null]]])assert.throws(()=>toCsv(v),TypeError);});
