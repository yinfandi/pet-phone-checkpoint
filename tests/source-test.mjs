#!/usr/bin/env node
/** source-test.mjs —— 外部数据源：外部化写死（无 chat.jsonl 引用）+ 过期自灭 + 失败静默 + 两种格式 */
import { readFileSync } from 'node:fs';
import { readSnapshot, SOURCE_ENV, DEFAULT_MAX_AGE_MS } from '../src/source.mjs';

let pass = 0, fail = 0;
const check = (n, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) { pass++; console.log('  ok  ' + n); }
  else { fail++; console.log(`  FAIL ${n}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); }
};

const NOW = 1_700_000_000_000;
const rd = (obj) => (p) => JSON.stringify(obj);   // 假 readFile

// ① 外部化写死：source.mjs 不得出现 pet-phone 自家流的引用
const srcText = readFileSync(new URL('../src/source.mjs', import.meta.url), 'utf8');
check('source.mjs 无 chat.jsonl 引用', /chat\.jsonl/.test(srcText), false);
check('source.mjs 无 chatPath 引用', /chatPath/.test(srcText), false);
check('source.mjs 无 PET_HOME 引用', /PET_HOME/.test(srcText), false);
check('默认 maxAge=30s', DEFAULT_MAX_AGE_MS, 30000);
check('SOURCE_ENV 名正确', SOURCE_ENV, 'PET_PHONE_CHECKPOINT_SOURCE');

// ② 未配置
check('未配置路径 → unconfigured', readSnapshot(undefined, { now: NOW }).reason, 'unconfigured');
check('空串路径 → unconfigured', readSnapshot('', { now: NOW }).reason, 'unconfigured');

// ③ 形式 A：{updatedAt, messages}
const formA = { updatedAt: NOW - 1000, messages: [
  { role: 'user', text: '在吗', at: NOW - 2000, session: 's1' },
] };
let r = readSnapshot('/x', { now: NOW, readFile: rd(formA) });
check('形式A ok', r.ok, true);
check('形式A messages 条数', r.messages.length, 1);
check('形式A updatedAt', r.updatedAt, NOW - 1000);

// ④ 形式 B：裸数组（updatedAt 从最大 at 推断）
const formB = [
  { role: 'user', text: '在', at: NOW - 3000, session: 's1' },
  { role: 'user', text: '还在', at: NOW - 1000, session: 's1' },
];
r = readSnapshot('/x', { now: NOW, readFile: rd(formB) });
check('形式B ok', r.ok, true);
check('形式B updatedAt=最大at', r.updatedAt, NOW - 1000);

// ⑤ 过期自灭：updatedAt 超 30s
const stale = { updatedAt: NOW - 31_000, messages: [{ role: 'user', text: '旧', at: NOW - 31_000, session: 's1' }] };
r = readSnapshot('/x', { now: NOW, readFile: rd(stale) });
check('过期 → ok=false', r.ok, false);
check('过期 → reason=stale', r.reason, 'stale');

// ⑥ 边界：正好 30s 内仍可用
const edge = { updatedAt: NOW - 30_000, messages: [{ role: 'user', text: '刚好', at: NOW - 30_000, session: 's1' }] };
check('30s 边界内可用', readSnapshot('/x', { now: NOW, readFile: rd(edge) }).ok, true);

// ⑦ 失败静默：读失败 / 坏 JSON / 坏形状
check('读失败 → unreadable', readSnapshot('/x', { now: NOW, readFile: () => { throw new Error('EACCES'); } }).reason, 'unreadable');
check('坏JSON → unreadable', readSnapshot('/x', { now: NOW, readFile: () => '{bad' }).reason, 'unreadable');
check('坏形状 → badshape', readSnapshot('/x', { now: NOW, readFile: rd({ foo: 1 }) }).reason, 'badshape');

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
