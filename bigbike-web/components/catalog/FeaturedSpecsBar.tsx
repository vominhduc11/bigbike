"use client";

import { useLocale, useTranslations } from "next-intl";
import { useLocalizedField } from "@/components/i18n/LocalizedContent";
import { sanitizeRichHtml } from "@/lib/utils/html";

/**
 * "Specs Dashboard" — dải ô số liệu nổi bật hiển thị ngay dưới khối mua hàng (theo mockup PDP). Đây là
 * "đòn chốt" bán hàng: mỗi ô là một số liệu lớn (value) + nhãn (label) trả lời câu hỏi "có đáng tiền
 * không", KHÔNG phải lặp lại thông số kỹ thuật. Admin quản theo từng sản phẩm (product.specStatsHtml,
 * V235/V256). HTML là nguồn render duy nhất — không còn lưới ô số liệu có cấu trúc để fallback. Đổi
 * ngôn ngữ qua `useLocalizedField("specStatsHtml")` (bản EN client refetch, giữ ISR/SEO). Rỗng → không
 * render gì.
 */
export function FeaturedSpecsBar({ viStatsHtml = "" }: { viStatsHtml?: string }) {
  const locale = useLocale();
  const t = useTranslations("Product");
  const enStatsHtml = useLocalizedField<string>("specStatsHtml");

  // "HTML thắng" (V256): có HTML (EN override khi đổi ngôn ngữ, hoặc bản vi) → render HTML đã
  // sanitize (cho phép CSS inline); rỗng → không render gì.
  const statsHtml = locale === "en" ? enStatsHtml : viStatsHtml;
  if (!statsHtml?.trim()) return null;

  const html = sanitizeRichHtml(statsHtml, { allowInlineStyles: true });
  if (!html) return null;
  return (
    <div
      role="region"
      aria-label={t("featuredSpecsTitle")}
      className="my-10 featured-specs-html"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
