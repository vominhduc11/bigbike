"use client";

import { createContext, useContext, type ReactNode, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocale } from "next-intl";
import { DEFAULT_LOCALE } from "@/i18n/locale";
import {
  fetchPublicArticle,
  fetchPublicBrand,
  fetchPublicCategory,
  fetchPublicProduct,
} from "@/lib/api/client-api";
import { sanitizeRichHtml } from "@/lib/utils/html";
import { ThemeAwareHtml } from "@/components/content/ThemeAwareHtml";

/**
 * Client-side content localizer — giữ kiến trúc ISR/SEO (server luôn render tĩnh `vi`,
 * xem `i18n/request.ts` + `docs/engineering/ARCHITECTURE.md` §i18n) nhưng cho phép đổi
 * DỮ LIỆU nội dung sang EN sau khi khách chọn ngôn ngữ — KHÔNG round-trip server, KHÔNG
 * phá ISR.
 *
 * Cách hoạt động:
 *  - `LocalizedContentProvider` bọc nội dung trang chi tiết. Children vẫn do SERVER render
 *    bằng `vi` (provider chỉ là client wrapper, truyền children qua) → HTML SEO canonical
 *    là `vi`, không hydration mismatch.
 *  - Khi locale hiện tại khác `vi`, provider refetch resource theo slug ở CLIENT và đưa
 *    bản EN vào context.
 *  - `LText` / `LHtml` là các nút lá đọc context: hiện field EN nếu có, fallback về bản
 *    `vi` (children / `viHtml` đã sanitize sẵn ở server) → render đầu khớp server.
 *
 * Nội dung EN fallback field-by-field về `vi` ở backend (PRODUCT_RULE_002 / ARTICLE / BRAND /
 * CATEGORY _RULE_002), nên field nào admin chưa dịch sẽ tự hiển thị `vi`.
 */

type LocalizableKind = "product" | "article" | "brand" | "category";

type LocalizedRecord = Record<string, unknown>;

const FETCHERS: Record<LocalizableKind, (slug: string, lang: string) => Promise<LocalizedRecord>> = {
  product: fetchPublicProduct,
  article: fetchPublicArticle,
  brand: fetchPublicBrand,
  category: fetchPublicCategory,
};

type LocalizedContextValue = { data: LocalizedRecord | null };

const LocalizedContentContext = createContext<LocalizedContextValue>({ data: null });

export function LocalizedContentProvider({
  kind,
  slug,
  children,
}: {
  kind: LocalizableKind;
  slug: string;
  children: ReactNode;
}) {
  const locale = useLocale();
  const isAlt = locale !== DEFAULT_LOCALE;

  const { data } = useQuery({
    queryKey: ["localized-content", kind, slug, locale],
    queryFn: () => FETCHERS[kind](slug, locale),
    // Chỉ fetch khi đổi sang ngôn ngữ khác `vi` — bản `vi` đã có sẵn từ server (props).
    enabled: isAlt && Boolean(slug),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <LocalizedContentContext.Provider value={{ data: isAlt ? data ?? null : null }}>
      {children}
    </LocalizedContentContext.Provider>
  );
}

/** Đọc một field top-level của resource đã localize (undefined khi đang ở `vi` hoặc chưa tải). */
export function useLocalizedField<T = unknown>(field: string): T | undefined {
  const { data } = useContext(LocalizedContentContext);
  return data ? (data[field] as T) : undefined;
}

/**
 * Chuỗi text dịch được: hiện field EN nếu có, fallback về `children` (bản `vi` server render).
 * Dùng cho tiêu đề/tên/nhãn lấy từ DB.
 */
export function LText({ field, children }: { field: string; children: ReactNode }) {
  const value = useLocalizedField<unknown>(field);
  const locale = useLocale();
  if (locale === "en" && typeof value === "string" && value.trim() !== "") {
    return <>{value}</>;
  }
  return <>{children}</>;
}

type LHtmlProps = {
  /** Tên field HTML trong resource (vd "body", "description", "shortDescription"). */
  field: string;
  /** HTML bản `vi` ĐÃ sanitize ở server — fallback, và là render đầu khớp server (no mismatch). */
  viHtml: string;
  className?: string;
  allowInlineStyles?: boolean;
  rewriteMediaUrls?: boolean;
};

const TRANSPARENT_THUMBNAIL =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='169' viewBox='0 0 300 169'%3E%3C/svg%3E";

/**
 * Khối HTML rich-text dịch được. Bản `vi` dùng `viHtml` (đã sanitize ở server) nguyên văn để
 * render đầu khớp server; chỉ khi có bản EN mới sanitize lại ở client và thay vào.
 */
export function LHtml({ field, viHtml, className, allowInlineStyles, rewriteMediaUrls }: LHtmlProps) {
  const value = useLocalizedField<unknown>(field);
  const locale = useLocale();
  const html =
    locale === "en" && typeof value === "string" && value.trim() !== ""
      ? sanitizeRichHtml(value, { allowInlineStyles, rewriteMediaUrls })
      : viHtml;

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleError = (event: Event) => {
      const target = event.target;
      if (target instanceof HTMLImageElement) {
        if (target.dataset.fallbackApplied) return;
        target.dataset.fallbackApplied = "true";
        target.src = TRANSPARENT_THUMBNAIL;
        target.classList.add("bb-news-img-placeholder");
      }
    };

    container.addEventListener("error", handleError, true);
    return () => {
      container.removeEventListener("error", handleError, true);
    };
  }, [html]);

  // allowInlineStyles: màu admin tự đặt có thể "chữ đen trên nền đen" khi bật dark
  // mode — render 2 bản (light/dark) song song, CSS chọn đúng bản (xem
  // ThemeAwareHtml + STYLEGUIDE.md §Dark mode). Bọc ngoài bằng đúng containerRef
  // để listener lỗi ảnh (capture-phase) vẫn bắt được ảnh lỗi ở CẢ 2 bản.
  if (allowInlineStyles) {
    return (
      <div ref={containerRef}>
        <ThemeAwareHtml className={className} html={html} />
      </div>
    );
  }

  return <div ref={containerRef} className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
