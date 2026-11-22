/**
 * source.mjs —— 外部数据源（外部化写死）。
 *
 * 唯一输入：环境变量 PET_PHONE_CHECKPOINT_SOURCE 指向的 JSON 快照文件。
 * 只读、不写。绝不读 pet-phone 自家的聊天流文件或其路径入口——
 * 这是"数据源外部化写死"的硬边界，由 source-test 断言。
 *
 * 过期自灭：updatedAt（或推断值）超过 maxAgeMs（默认 30s）→ 视为不可用。
 * 失败静默：任何读/解析错误 → 返回 ok:false，不抛异常、不影响调用方。
 */
import { readFileSync } from 'node:fs';

export const SOURCE_ENV = 'PET_PHONE_CHECKPOINT_SOURCE';
export const DEFAULT_MAX_AGE_MS = 30_000;

/** 从消息里推断最新 at（形式 B 裸数组没有 updatedAt 时用）。 */
function inferUpdatedAt(messages, now) {
  let max = 0;
  for (const m of messages) {
    const at = Number(m?.at);
    if (Number.isFinite(at) && at > max) max = at;
  }
  // 没时间戳就退回 now——空快照不该被判成"陈旧"，由调用方按空列表处理。
  return max || now;
}

/**
 * 读外部快照。
 * @param {string|undefined} path 快照路径；undefined/空 → 未配置 → ok:false, reason:'unconfigured'
 * @param {{now?:number, maxAgeMs?:number, readFile?:Function}} [opts]
 * @returns {{ok:boolean, reason?:string, messages:Array, updatedAt:number}}
 */
export function readSnapshot(path, opts = {}) {
  const now = opts.now ?? Date.now();
  const maxAgeMs = opts.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
  const readFile = opts.readFile ?? readFileSync;
  const empty = (reason) => ({ ok: false, reason, messages: [], updatedAt: 0 });

  if (!path || typeof path !== 'string') return empty('unconfigured');

  let data;
  try {
    const raw = readFile(path, 'utf8');
    data = JSON.parse(raw);
  } catch (e) {
    return empty('unreadable');
  }

  // 形式 A: { updatedAt, messages:[...] }；形式 B: 裸数组 [...]
  const messages = Array.isArray(data) ? data : (Array.isArray(data?.messages) ? data.messages : null);
  if (!messages) return empty('badshape');

  const updatedAt = Number.isFinite(data?.updatedAt)
    ? Number(data.updatedAt)
    : inferUpdatedAt(messages, now);

  // 过期自灭：源超过 maxAgeMs 没更新就闭嘴。
  if (now - updatedAt > maxAgeMs) return { ok: false, reason: 'stale', messages: [], updatedAt };

  return { ok: true, messages, updatedAt };
}
