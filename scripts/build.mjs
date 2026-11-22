/**
 * build.mjs —— 检查点插件的"构建"。
 * 本插件是零依赖纯 ESM，不需要 esbuild 打包：入口直接是 src/index.mjs。
 * 构建 = ① 语法校验所有源文件（node --check）② 写 dist/build-info.json 指纹。
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const SRC = [
  'src/index.mjs',
  'src/source.mjs',
  'src/warrants.mjs',
  'src/checkpoint.mjs',
  'src/reply.mjs',
];

for (const f of SRC) {
  execFileSync(process.execPath, ['--check', f], { stdio: 'inherit' });
}

const inputs = ['src/index.mjs', 'package.json', 'dsh.plugin.json'];
const digest = createHash('sha256')
  .update(inputs.map((f) => readFileSync(f)).join('\n'))
  .digest('hex');

mkdirSync('dist', { recursive: true });
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
let commit = null;
try {
  commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
} catch { /* 没有 git 也能构建 */ }
writeFileSync(
  'dist/build-info.json',
  `${JSON.stringify({ schema: 1, name: pkg.name, version: pkg.version, commit, productDigest: digest }, null, 2)}\n`,
);

console.log(`built ${pkg.name}@${pkg.version} (zero-dep ESM, ${SRC.length} modules checked)`);
