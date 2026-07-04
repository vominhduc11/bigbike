"use client";

import { useSyncExternalStore } from "react";

/**
 * Theme store — module-level, not React Context. Chỉ 2 trạng thái: light/dark
 * (không có "system" — khách bật/tắt bằng công tắc trong header). Chỉ một UI
 * đọc store này (ThemeToggle, render 2 nơi: desktop header + mobile drawer, cả
 * 2 luôn mount, ẩn/hiện bằng CSS breakpoint chứ không unmount) nên dùng shared
 * external store thay vì Context để 2 instance luôn đồng bộ. Xem app/layout.tsx
 * cho anti-flash script (set trước khi React hydrate).
 */

export type Theme = "light" | "dark";

export const THEME_COOKIE = "bb_theme";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year — same as LOCALE_COOKIE (ClientIntlProvider.tsx)

function readCookieTheme(): Theme {
  if (typeof document === "undefined") return "light";
  const match = document.cookie.split("; ").find((row) => row.startsWith(`${THEME_COOKIE}=`));
  return match?.split("=")[1] === "dark" ? "dark" : "light";
}

function applyToDom(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
}

let current: Theme = "light";
let bootstrapped = false;
const listeners = new Set<() => void>();

function bootstrap(): void {
  if (bootstrapped || typeof document === "undefined") return;
  bootstrapped = true;
  current = readCookieTheme();
}

export function subscribeThemeStore(callback: () => void): () => void {
  bootstrap();
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot(): Theme {
  bootstrap();
  return current;
}

function getServerSnapshot(): Theme {
  // Server luôn render KHÔNG có data-theme (xem STYLEGUIDE.md §Dark mode) →
  // CSS mặc định light — đây là giá trị đúng thực tế, không phải đoán mò.
  return "light";
}

/** Đổi theme: cập nhật DOM ngay (phản hồi tức thời) + ghi cookie bền (bb_theme). */
export function setTheme(next: Theme): void {
  bootstrap();
  current = next;
  applyToDom(next);
  document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
  listeners.forEach((cb) => cb());
}

export function toggleTheme(): void {
  setTheme(getSnapshot() === "dark" ? "light" : "dark");
}

/** Theme hiện tại: "light" | "dark". */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribeThemeStore, getSnapshot, getServerSnapshot);
}
