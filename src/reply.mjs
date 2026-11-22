/**
 * reply.mjs —— 回话接口（只预留，不内建通道）。
 *
 * 契约：AI 的回复由外部桥写回数据源（追加 role:"assistant" 行）；本插件不建任何消息通道。
 * 唯一扩展点 config.replySink(text, meta)——由宿主/外部桥注入；未注入则 write() 返回 false。
 */

/** 造一个回话口。sink 缺省 → 空实现，write 恒 false（诚实：本插件不内建通道）。 */
export function replyInterface(config = {}) {
  const sink = typeof config.replySink === 'function' ? config.replySink : null;
  return {
    /** 有外部 sink 就交给它写回；返回是否写出去了。 */
    write(text, meta = {}) {
      if (!sink) return false;
      try {
        sink(String(text ?? ''), meta);
        return true;
      } catch {
        return false;   // 失败静默
      }
    },
    get connected() { return !!sink; },
  };
}
