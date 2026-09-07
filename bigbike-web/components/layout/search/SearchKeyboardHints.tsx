"use client";

import { useTranslations } from "next-intl";

/**
 * Chú thích phím tắt của bảng gợi ý. Chỉ hiện trên máy tính — màn cảm ứng không có
 * ↑↓/↵/Esc nên dòng này vô nghĩa ở đó (chốt với chủ shop 2026-09-07).
 */
export function SearchKeyboardHints() {
  const t = useTranslations("Search");

  return (
    <div
      className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t border-border bg-background px-3 py-2 font-body text-b5-label text-muted-foreground max-md:hidden"
      data-search-keyboard-hints
    >
      <span>
        <kbd className="font-cta text-foreground">↑↓</kbd> {t("footerMove")}
      </span>
      <span>
        <kbd className="font-cta text-foreground">↵</kbd> {t("footerSelect")}
      </span>
      <span>
        <kbd className="font-cta text-foreground">{t("footerEscapeKey")}</kbd> {t("footerClose")}
      </span>
    </div>
  );
}
