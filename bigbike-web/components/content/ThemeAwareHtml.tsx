import { transformHtmlForDark } from "@/lib/utils/richtext-dark-transform";

type ThemeAwareHtmlProps = {
  /** HTML đã sanitize (sanitizeRichHtml with allowInlineStyles: true) — KHÔNG truyền raw HTML. */
  html: string;
  className?: string;
};

/**
 * Render khối HTML admin dán (style inline) an toàn cho cả 2 theme mà KHÔNG
 * cần biết theme lúc render (giữ ISR/SSG cho PDP — xem STYLEGUIDE.md §Dark
 * mode, quyết định kiến trúc #2). Render song song bản gốc (light, không đụng
 * gì) + bản đã chuyển màu (dark, xem lib/utils/richtext-dark-transform.ts);
 * CSS thuần trong app/globals.css (khối "DARK MODE — LAYER C") chỉ hiện đúng
 * 1 bản theo `[data-theme]` trên `<html>`.
 */
export function ThemeAwareHtml({ html, className }: ThemeAwareHtmlProps) {
  return (
    <>
      <div className={className} data-theme-variant="light" dangerouslySetInnerHTML={{ __html: html }} />
      <div
        className={className}
        data-theme-variant="dark"
        dangerouslySetInnerHTML={{ __html: transformHtmlForDark(html) }}
      />
    </>
  );
}
