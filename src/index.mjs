/**
 * pet-phone-checkpoint —— 从 pet-phone 拆出的独立检查点组件。
 *
 * v0.1 只做一件事：工具返回后（tools/post-execute），把外部未读消息作为文本块
 * 追加进结果——"任务中途，停一下，听一下"。不驱动会话、不内建通道、无铃无窗无通讯录。
 *
 * 只挂一个事件；waterfall 先 next()、全程 try/catch、只认 accept、失败静默。
 */
import { readSnapshot, SOURCE_ENV, DEFAULT_MAX_AGE_MS } from './source.mjs';
import { createCheckpoint } from './checkpoint.mjs';
import { replyInterface } from './reply.mjs';

export const name = 'pet-phone-checkpoint';
export const inject = [];   // 不注入工具/技能——本插件只有一个 post-execute 钩子

export async function apply(ctx, config = {}) {
  const info = (m) => ctx?.logger?.info?.(m);
  const warn = (m) => ctx?.logger?.warn?.(m);

  const enabled = () =>
    config.enabled !== false && process.env.PET_PHONE_CHECKPOINT !== '0';

  const source = config.source ?? process.env[SOURCE_ENV];
  const level = config.level ?? process.env.PET_PHONE_CHECKPOINT_LEVEL ?? 'default';
  const maxAgeMs = config.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
  const cp = createCheckpoint({ level, replyCooldownMs: config.replyCooldownMs });
  const reply = replyInterface(config);

  // 回话口挂到 ctx 上供宿主/外部桥取用（预留，不内建通道）。
  try { ctx.checkpointReply = reply; } catch { /* 宿主不允许挂字段就算了 */ }

  ctx.effect(() =>
    ctx.on('tools/post-execute', async (exec, result, next) => {
      const d = await next();                       // waterfall：先放行，绝不截断管线
      try {
        if (!enabled()) return d;
        if (!d || d.kind !== 'accept') return d;    // kind 非 accept 不动
        if (!Array.isArray(result?.content)) return d;

        // session 从 exec 取；取不到就跳过（宁可不做，不串台）。
        const sid = exec?.agent?.session?.id ?? exec?.session?.id;
        if (!sid) return d;

        const snap = readSnapshot(source, { maxAgeMs });
        if (!snap.ok) return d;                     // 未配置/过期/读失败 → 静默

        const text = cp.run(snap.messages, sid);
        if (!text) return d;                        // 没值得提的 → 原样返回（敢什么都不做）

        if (config.verbose) info('checkpoint: inject reminder');
        return { ...d, content: [...result.content, { type: 'text', text }] };
      } catch (e) {
        // 失败静默：任何异常都不弄坏工具管线。
        try { warn(`checkpoint: ${String(e?.message).slice(0, 200)}`); } catch { /* noop */ }
        return d;
      }
    }),
  );

  if (config.verbose) info('pet-phone-checkpoint 已注册（tools/post-execute）');
}
