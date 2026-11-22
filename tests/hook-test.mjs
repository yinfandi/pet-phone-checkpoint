#!/usr/bin/env node
/** hook-test.mjs —— post-execute 行为：只挂一个事件 / waterfall / 只认 accept / 只追加 / 一键关 / 失败静默 / 无通道 */
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { apply, name, inject } from '../src/index.mjs';
import { replyInterface } from '../src/reply.mjs';

let pass = 0, fail = 0;
const check = (n, got, want) => {
  if (got === want) { pass++; console.log('  ok  ' + n); }
  else { fail++; console.log(`  FAIL ${n}: got ${got} want ${want}`); }
};

check('插件名', name, 'pet-phone-checkpoint');
check('不注入工具/技能', JSON.stringify(inject), '[]');

// 假 ctx：收集 on() 注册的事件
function makeCtx() {
  const handlers = {};
  const effects = [];
  return {
    handlers,
    effects,
    logger: { info() {}, warn() {} },
    on(evt, fn) { handlers[evt] = fn; return () => {}; },
    effect(fn) { effects.push(fn); fn(); },   // 真 DSH 的 ctx.effect 会立即执行 fn 登记监听
  };
}

const home = mkdtempSync(join(tmpdir(), 'cp-hook-'));
const NOW = Date.now();
const snapPath = join(home, 'snapshot.json');
writeFileSync(snapPath, JSON.stringify({
  updatedAt: NOW,
  messages: [
    { role: 'assistant', text: '早回', at: NOW - 300000, session: 's1' },
    { role: 'user', text: '你还在吗', at: NOW - 3000, session: 's1' },
  ],
}));

const exec = { name: 'some_tool', agent: { session: { id: 's1' } } };
const okResult = (content) => ({ kind: 'accept', content });
const nextOk = async () => ({ kind: 'accept', content: [{ type: 'text', text: '原结果' }] });

console.log('\n=== 只挂一个 post-execute 事件 ===');
{
  const ctx = makeCtx();
  await apply(ctx, { source: snapPath, verbose: false });
  check('只注册 1 个事件', Object.keys(ctx.handlers).length, 1);
  check('事件名=tools/post-execute', Object.keys(ctx.handlers)[0], 'tools/post-execute');
  check('effect 被登记 1 次', ctx.effects.length, 1);
}

console.log('\n=== 注入行为 ===');
{
  const ctx = makeCtx();
  await apply(ctx, { source: snapPath });
  const h = ctx.handlers['tools/post-execute'];
  const d = await h(exec, okResult([{ type: 'text', text: '原结果' }]), nextOk);
  check('accept → content 增加一块', d.content.length, 2);
  check('原文未被替换', d.content[0].text, '原结果');
  check('追加的是提醒块（只改追加块）', d.content[1].text.includes('检查点·未读'), true);
  check('kind 保持', d.kind, 'accept');
}

console.log('\n=== kind 非 accept 不动 ===');
{
  const ctx = makeCtx();
  await apply(ctx, { source: snapPath });
  const h = ctx.handlers['tools/post-execute'];
  const nextDeny = async () => ({ kind: 'deny', content: [] });
  const d = await h(exec, okResult([]), nextDeny);
  check('deny → 原样返回', JSON.stringify(d), JSON.stringify({ kind: 'deny', content: [] }));
}

console.log('\n=== 取不到 session → 不注入（不串台）===');
{
  const ctx = makeCtx();
  await apply(ctx, { source: snapPath });
  const h = ctx.handlers['tools/post-execute'];
  const d = await h({}, okResult([{ type: 'text', text: '原' }]), nextOk);
  check('无 exec.session → content 不增', d.content.length, 1);
}

console.log('\n=== 一键关 config.enabled=false ===');
{
  const ctx = makeCtx();
  await apply(ctx, { source: snapPath, enabled: false });
  const h = ctx.handlers['tools/post-execute'];
  const d = await h(exec, okResult([{ type: 'text', text: '原' }]), nextOk);
  check('enabled=false → content 不增', d.content.length, 1);
}

console.log('\n=== 未配置数据源 → 静默 ===');
{
  const ctx = makeCtx();
  await apply(ctx, {});   // 无 source（本进程也没设 env）
  const h = ctx.handlers['tools/post-execute'];
  const d = await h(exec, okResult([{ type: 'text', text: '原' }]), nextOk);
  check('无 source → content 不增', d.content.length, 1);
}

console.log('\n=== 失败静默：handler 里 next 抛错也不影响管线 ===');
{
  const ctx = makeCtx();
  await apply(ctx, { source: snapPath });
  const h = ctx.handlers['tools/post-execute'];
  let threw = false;
  try {
    await h(exec, okResult([]), async () => { throw new Error('boom'); });
  } catch { threw = true; }
  // next 先于 try/catch 执行——这是 waterfall 契约：异常由 DSH 管线处理，插件不吞 next 的错。
  check('next 抛错向上传播（符合 waterfall）', threw, true);
}

console.log('\n=== 回话接口预留（不内建通道）===');
{
  const noSink = replyInterface({});
  check('无 sink → connected=false', noSink.connected, false);
  check('无 sink → write 返回 false', noSink.write('hi'), false);
  let written = null;
  const withSink = replyInterface({ replySink: (t) => { written = t; } });
  check('有 sink → connected=true', withSink.connected, true);
  check('有 sink → write 返回 true', withSink.write('回一句'), true);
  check('sink 收到文本', written, '回一句');
  const throwSink = replyInterface({ replySink: () => { throw new Error('x'); } });
  check('sink 抛错 → write 静默 false', throwSink.write('x'), false);
}

rmSync(home, { recursive: true, force: true });
console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
