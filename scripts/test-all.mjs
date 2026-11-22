/**
 * test-all.mjs —— 跑全部测试文件，汇总 FAIL。
 */
import { readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const tests = readdirSync('tests').filter((f) => f.endsWith('-test.mjs')).sort();
let totalFail = 0;
for (const t of tests) {
  console.log(`\n===== ${t} =====`);
  try {
    execFileSync(process.execPath, [`tests/${t}`], { stdio: 'inherit' });
  } catch {
    totalFail++;
  }
}
console.log(`\n===== 汇总: ${tests.length} 个测试文件, ${totalFail} 失败 =====`);
process.exit(totalFail ? 1 : 0);
