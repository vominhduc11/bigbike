"use client";

import { useEffect } from "react";

type WpTarget = { selector: string; events: string };

/**
 * Gỡ các handler jQuery mà theme WP cũ (`home.min.js`) bind đè lên đúng phần tử
 * React đang quản.
 *
 * `home.min.js` chạy `front_app.init()` MỘT lần lúc tải nguyên trang (gate
 * `body.js-loaded`) và bind selector trùng với markup React (đổi tab, sort danh mục,
 * drawer lọc mobile…) → double handler: React + jQuery cùng xử lý một sự kiện theo
 * cách đối nghịch (declarative vs imperative). React đã tự quản hành vi nên ta gỡ
 * handler jQuery khỏi CHÍNH các phần tử đó.
 *
 * An toàn:
 *  - `jQuery(...).off(events)` chỉ gỡ handler trong registry của jQuery; React 17+
 *    gắn listener ở root container nên KHÔNG bị ảnh hưởng.
 *  - Chỉ off đúng selector truyền vào → KHÔNG đụng phần tử do WP sở hữu hợp lệ
 *    (header hamburger/drawer, footer accordion, scrollToTop…).
 *  - Khi điều hướng SPA, `home.min.js` không chạy lại nên không có gì để gỡ → no-op.
 *
 * Vì script WP là `afterInteractive`, nó có thể bind SAU khi effect này chạy. `off()`
 * idempotent nên ta thử lại vài nhịp ngắn để chắc chắn bắt được lần bind đó.
 */
export function useDetachWpHandlers(targets: WpTarget[]) {
  useEffect(() => {
    const delays = [0, 250, 600, 1200, 2000];
    const timers: number[] = [];

    function detach() {
      const jq = (window as unknown as { jQuery?: (s: string) => { off: (e: string) => unknown } }).jQuery;
      if (!jq) return;
      for (const { selector, events } of targets) {
        jq(selector).off(events);
      }
    }

    for (const d of delays) {
      timers.push(window.setTimeout(detach, d));
    }
    return () => timers.forEach((t) => window.clearTimeout(t));
    // targets là literal cố định tại call-site; bỏ qua thay đổi tham chiếu mỗi render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
