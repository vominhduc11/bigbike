"use client";

import { useLocale, useTranslations } from "next-intl";
import { useLocalizedField } from "@/components/i18n/LocalizedContent";
import { sanitizeRichHtml } from "@/lib/utils/html";
import type { ProductSpecStat } from "@/lib/contracts/public";

/**
 * "Specs Dashboard" — dải ô số liệu nổi bật hiển thị ngay dưới khối mua hàng (theo mockup PDP). Đây là
 * "đòn chốt" bán hàng: mỗi ô là một số liệu lớn (value) + nhãn (label) trả lời câu hỏi "có đáng tiền
 * không", KHÔNG phải lặp lại thông số kỹ thuật. Admin quản theo từng sản phẩm (product.specStats, V235),
 * tối đa 4 ô. Dùng token màu/font web — KHÔNG hardcode. Đổi ngôn ngữ qua `useLocalizedField("specStats")`
 * (bản EN client refetch, giữ ISR/SEO). Rỗng → không render gì.
 */
const MAX = 4;

export function FeaturedSpecsBar({
  stats,
  viStatsHtml = "",
}: {
  stats: ProductSpecStat[];
  viStatsHtml?: string;
}) {
  const locale = useLocale();
  const t = useTranslations("Product");
  const enStats = useLocalizedField<ProductSpecStat[]>("specStats");
  const enStatsHtml = useLocalizedField<string>("specStatsHtml");

  // "HTML thắng" (V256): có HTML (EN override khi đổi ngôn ngữ, hoặc bản vi) → render HTML đã
  // sanitize (cho phép CSS inline), bỏ qua lưới ô số liệu có cấu trúc.
  const statsHtml = locale === "en" ? enStatsHtml : viStatsHtml;
  if (statsHtml && statsHtml.trim()) {
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

  const source = locale === "en" ? enStats : stats;
  const boxes = (source ?? []).filter((s) => s?.value?.trim() && s?.label?.trim()).slice(0, MAX);

  if (boxes.length === 0) return null;

  return (
    <div
      role="region"
      className="my-10 grid grid-cols-2 gap-px border border-border bg-border md:grid-cols-4"
      aria-label={t("featuredSpecsTitle")}
    >
      {boxes.map((s, i) => (
        <div
          key={i}
          className="flex flex-col items-center gap-1.5 bg-background px-4 py-6 text-center transition-colors hover:bg-muted/40"
        >
          <span className="font-body text-ui-24 max-md:text-ui-22 font-bold uppercase leading-none tracking-tight text-brand">
            {s.value}
          </span>
          <span className="text-ui-14 max-md:text-ui-12 font-semibold uppercase tracking-wide text-muted-foreground">
            {s.label}
          </span>
        </div>
      ))}
    </div>
  );
}
