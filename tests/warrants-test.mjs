#!/usr/bin/env node
/** warrants-test.mjs —— 从活库真值表提取（原样）+ level 档位 */
import { warrantsResponse, isExplicitNoise } from '../src/warrants.mjs';

let pass = 0, fail = 0;
const check = (n, got, want) => {
  if (got === want) { pass++; console.log('  ok  ' + n); }
  else { fail++; console.log(`  FAIL ${n}: got ${got} want ${want}`); }
};

const NOW = 1_000_000_000;
const ctx = { now: NOW };
const recent = (text) => ({ text, at: NOW - 1000 });
const old = (text) => ({ text, at: NOW - 40 * 60 * 1000 });   // 40min > 30min

console.log('=== 假阴性三条（活库断言，不许改回去）===');
check('"你还在" → 该回', warrantsResponse(recent('你还在'), ctx), true);
check('"听得到么" → 该回', warrantsResponse(recent('听得到么'), ctx), true);
check('"啥情况" → 该回', warrantsResponse(recent('啥情况'), ctx), true);
check('"能听到响铃么" → 该回', warrantsResponse(recent('能听到响铃么'), ctx), true);
check('裸"？" → 该回', warrantsResponse(recent('？'), ctx), true);
check('"好的，继续"（带内容）→ 该回', warrantsResponse(recent('好的，继续'), ctx), true);

console.log('\n=== 明确噪音静默（默认档）===');
for (const s of ['嗯', '好的', '…', '😂', 'ok', '收到']) {
  check(`"${s}" → 不叫（default）`, warrantsResponse(recent(s), ctx, 'default'), false);
}
check('空消息 → 不叫', warrantsResponse(recent(''), ctx), false);
check('isExplicitNoise("嗯嗯")', isExplicitNoise('嗯嗯'), true);
check('isExplicitNoise("嗯？") 非纯噪音', isExplicitNoise('嗯？'), false);

console.log('\n=== 四条过滤 ===');
check('早已回过 → 不叫', warrantsResponse(recent('在吗？'), { now: NOW, lastResponseAt: NOW }), false);
check('太旧(40min) → 不叫', warrantsResponse(old('在吗？'), ctx), false);

console.log('\n=== level=all 档位（A2）===');
check('all 档："嗯" 也提醒', warrantsResponse(recent('嗯'), ctx, 'all'), true);
check('all 档：空仍不提醒', warrantsResponse(recent(''), ctx, 'all'), false);
check('all 档：太旧仍不提醒', warrantsResponse(old('在吗？'), ctx, 'all'), false);

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
