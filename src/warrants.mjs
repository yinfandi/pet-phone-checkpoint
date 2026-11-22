/**
 * warrants.mjs —— 从 ying-pet-phone 活库 core/judge/warrants.mjs 原样提取的判断真值表。
 * 纯函数、零宿主依赖、可离线测。
 *
 * 改造点（唯一）：warrantsResponse 增加 level 参数（A2 档位可配）：
 *   - default（默认）：原库行为——默认叫，只静默"明确噪音"（空/省略号/emoji/白名单/太旧/已回）。
 *   - all：所有非空未读都叫（假阴性保险拉满，噪音也提醒）。
 *
 * 原库真值表（假阴性三条）保持为断言，不许改回去：
 *   "你还在" / "听得到么" / "啥情况" 一律该回。
 */

const BARE_ACKS = new Set([
  '嗯', '嗯嗯', '嗯呢', '哦', '哦哦', '喔', '好', '好的', '好滴', '好吧', '好好',
  '行', '行吧', 'ok', 'okay', 'k', 'kk',
  '哈', '哈哈', '呵', '呵呵', '嘿', '嘿嘿', '嘻嘻',
  '收到', '知道了', '明白', '了解', '得嘞',
  '👌', '👍', '😂', '😄',
]);

const ONLY_ELLIPSIS = /^[.…。·\s]+$/;
const ONLY_EMOJI = /^[\p{Extended_Pictographic}\uFE0F\s]+$/u;

export function normalize(text) {
  return String(text ?? '').replace(/\u3000/g, ' ').replace(/\s+/g, ' ').trim();
}

export function isExplicitNoise(text) {
  const t = normalize(text);
  if (t === '') return true;
  if (ONLY_ELLIPSIS.test(t)) return true;
  if (ONLY_EMOJI.test(t)) return true;
  return BARE_ACKS.has(t.replace(/\s+/g, ''));
}

/**
 * 一条消息值不值得"额外叫一次"。
 * @param {{text:string, at:number}} msg
 * @param {{now?:number, sinceMs?:number, lastResponseAt?:number}} ctx
 * @param {'default'|'all'} [level='default']
 */
export function warrantsResponse(msg, ctx, level = 'default') {
  const now = ctx.now ?? Date.now();
  const at = msg?.at ?? 0;
  const text = String(msg?.text ?? '');

  if (normalize(text) === '') return false;                     // 1. 空
  const lastResponseAt = ctx.lastResponseAt ?? 0;
  if (lastResponseAt && lastResponseAt >= at) return false;     // 2. 早已回过
  const sinceMs = ctx.sinceMs ?? 30 * 60 * 1000;                // 3. 太旧
  if (now - at > sinceMs) return false;
  if (level !== 'all' && isExplicitNoise(text)) return false;   // 4. 明确噪音（all 档跳过）
  return true;                                                  // 默认：该回
}

