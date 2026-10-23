import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = await readFile(resolve(root, 'public/shared/calculator.js'), 'utf8');
const context = {};
vm.createContext(context);
vm.runInContext(source, context);
const evaluate = context.HotelOperationsCalculator.evaluate;

assert.equal(evaluate('1680 × 2 − 100'), 3260);
assert.equal(evaluate('0.1 + 0.2'), 0.3);
assert.equal(evaluate('(1+2)*3'), 9);
assert.equal(evaluate('-5 + 10'), 5);
assert.throws(() => evaluate('10 / 0'), /计算结果无效/);
assert.throws(() => evaluate('(1+2'), /请输入有效的算式/);
assert.throws(() => evaluate(''), /请输入有效的算式/);
assert.throws(() => evaluate('1+abc'), /请输入有效的算式/);

console.log('Calculator regression tests passed');
