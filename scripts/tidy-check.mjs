/**
 * tidy-check.mjs —— 库整洁门禁：
 *   ① package.json files 白名单：列出的每个文件都存在（无悬空条目）；
 *   ② 需要的源码文件都在白名单里（无漏列——"源码绿、装机崩"的高发区）；
 *   ③ 源码里的相对 import 目标都存在（无悬空引用）。
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

let fail = 0;
const FAIL = (m) => { fail++; console.log('FAIL ' + m); };
const OK = (m) => console.log('  ok  ' + m);

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const files = pkg.files ?? [];

// ① 白名单条目全部存在
for (const f of files) {
  if (existsSync(f)) OK(`files 条目存在: ${f}`);
  else FAIL(`files 白名单悬空: ${f}`);
}

// ② 必须包含的源码/元数据都在白名单
const REQUIRED = [
  'src/index.mjs', 'src/source.mjs', 'src/warrants.mjs', 'src/checkpoint.mjs', 'src/reply.mjs',
  'dsh.plugin.json', 'cordis.patch.yml', 'docs/SPEC.md', 'README.md', 'LICENSE',
];
for (const r of REQUIRED) {
  if (files.includes(r)) OK(`必需文件已列: ${r}`);
  else FAIL(`必需文件漏列 files: ${r}`);
}

// ③ 相对 import 无悬空
const SRCS = REQUIRED.filter((f) => f.endsWith('.mjs'));
for (const f of SRCS) {
  const text = readFileSync(f, 'utf8');
  for (const m of text.matchAll(/from\s+['"](\.[^'"]+)['"]/g)) {
    const target = resolve(dirname(f), m[1]);
    if (existsSync(target)) OK(`${f} → ${m[1]}`);
    else FAIL(`${f} 悬空 import: ${m[1]}`);
  }
}

console.log(`\nFAIL ${fail}`);
process.exit(fail ? 1 : 0);
