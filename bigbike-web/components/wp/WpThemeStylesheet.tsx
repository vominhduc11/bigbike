"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { useServerInsertedHTML } from "next/navigation";

/**
 * Nạp bundle CSS theme WP riêng của từng trang (`wp-theme-*.css`) sao cho TẠI MỌI
 * THỜI ĐIỂM chỉ có ĐÚNG bundle của trang hiện tại đang áp dụng — kể cả khi điều
 * hướng client từ trang khác sang.
 *
 * Vì sao không dùng `<link rel="stylesheet" precedence>` trực tiếp: React (qua cơ
 * chế tích hợp Suspense) KHÔNG gỡ stylesheet khi chuyển route — xem
 * `node_modules/next/dist/docs/01-app/01-getting-started/11-css.md` ("this currently
 * does not remove stylesheets as you navigate between routes which can lead to
 * conflicts"). Hệ quả: bundle của trang trước nằm lại và đè lên trang sau → cùng một
 * trang trông KHÁC nhau giữa lúc bấm-chuyển-vào và lúc F5 (ví dụ nhãn ngày tin tức).
 *
 * Cách làm ở đây: tự sở hữu thẻ `<link>` thay vì để React Float quản:
 *  - Lần tải đầu (SSR): inject `<link>` vào `<head>` MỘT lần qua `useServerInsertedHTML`
 *    → render-blocking như cũ, không chớp giao diện, vẫn chạy khi tắt JS.
 *  - Client: trang vừa vào tự thêm bundle của mình rồi GỠ các bundle wp-theme khác →
 *    đúng bằng trạng thái khi F5. Vì các thẻ này KHÔNG do React Float quản nên gỡ an
 *    toàn (không hỏng map nội bộ của React, back/forward vẫn nạp lại đúng).
 */

const ATTR = "data-wp-theme";
const SELECTOR = `link[${ATTR}]`;

// Chạy trước khi paint ở client (đổi bundle không kịp chớp); ở server thì noop —
// useLayoutEffect không chạy khi SSR nên dùng useEffect để tránh cảnh báo.
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

function pruneExcept(keep: HTMLLinkElement) {
  for (const el of document.head.querySelectorAll(SELECTOR)) {
    if (el !== keep) el.remove();
  }
}

export function WpThemeStylesheet({ href }: { href: string }) {
  // SSR: phát thẻ link vào <head> đúng một lần cho lần tải đầu.
  const injected = useRef(false);
  useServerInsertedHTML(() => {
    if (injected.current) return null;
    injected.current = true;
    return <link rel="stylesheet" href={href} data-wp-theme="" />;
  });

  // Client: đảm bảo chỉ còn duy nhất bundle của trang hiện tại. Việc dọn bundle cũ do
  // trang MỚI làm (không dọn lúc unmount) để bản cũ còn giữ giao diện tới khi bản mới
  // tải xong → không chớp trắng.
  useIsomorphicLayoutEffect(() => {
    const head = document.head;
    const current = Array.from(head.querySelectorAll<HTMLLinkElement>(SELECTOR)).find(
      (el) => el.getAttribute("href") === href,
    );

    if (current) {
      pruneExcept(current);
      return;
    }

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.setAttribute(ATTR, "");
    link.href = href;
    const settle = () => pruneExcept(link);
    link.addEventListener("load", settle, { once: true });
    link.addEventListener("error", settle, { once: true });
    head.appendChild(link);
  }, [href]);

  return null;
}
