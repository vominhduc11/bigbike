"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, X, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { richContentClassName } from "@/components/layout/RichContent";
import { useLocalizedField } from "@/components/i18n/LocalizedContent";
import { LHtml } from "@/components/i18n/LocalizedContent";
import { sanitizeRichHtml } from "@/lib/utils/html";
import { resolveMediaUrl } from "@/lib/utils/format";
import { HomeVideoCarousel } from "@/components/home/HomeVideoCarousel";
import type { VideoAsset, HomeVideo, ProductHighlight } from "@/lib/contracts/public";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

/**
 * Các mảnh nội dung sản phẩm dịch được trong tab PDP — đọc bản EN từ
 * `LocalizedContentProvider` (kind="product") nếu có, fallback về props `vi` render
 * sẵn ở server. Tách riêng để page.tsx (server) giữ nguyên kiến trúc ISR/SEO.
 */

type Faq = { question?: string | null; answer?: string | null };

/** Lấy danh sách câu (content) từ mảng ProductHighlight, bỏ rỗng. */
function highlightLines(notes: ProductHighlight[] | undefined): string[] {
  return (notes ?? []).map((h) => (h?.content ?? "").trim()).filter(Boolean);
}

/**
 * Khối "Ưu điểm & Nhược điểm" — KHỐI RIÊNG cố định dưới mô tả (ngoài tab), 2 cột xanh/đỏ. Nguồn dữ
 * liệu là bảng con product_highlights (admin nhập ở card riêng), cũng là nguồn schema.org
 * positiveNotes/negativeNotes. Đổi ngôn ngữ: lấy bản EN qua useLocalizedField, fallback props `vi`.
 */
export function ProductProsCons({
  positiveNotes,
  negativeNotes,
}: {
  positiveNotes: ProductHighlight[];
  negativeNotes: ProductHighlight[];
}) {
  const t = useTranslations("Product");
  const locale = useLocale();
  const enPos = useLocalizedField<ProductHighlight[]>("positiveNotes");
  const enNeg = useLocalizedField<ProductHighlight[]>("negativeNotes");
  const positive = highlightLines(locale === "en" ? enPos : positiveNotes);
  const negative = highlightLines(locale === "en" ? enNeg : negativeNotes);
  if (positive.length === 0 && negative.length === 0) return null;
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {positive.length > 0 && (
        <div className="border-t-2 border-t-pros-accent bg-pros-accent/[0.07] p-5">
          <h3 className="mb-3 font-heading text-20 max-md:text-ui-18 font-bold uppercase tracking-wide text-pros-accent">
            {t("prosTitle")}
          </h3>
          <ul className="flex flex-col gap-2">
            {positive.map((note, index) => (
              <li key={index} className="flex gap-2 text-18 max-md:text-ui-16 text-foreground">
                <Check className="mt-1 h-4 w-4 shrink-0 text-pros-accent" aria-hidden />
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {negative.length > 0 && (
        <div className="border-t-2 border-t-cons-accent bg-cons-accent/[0.06] p-5">
          <h3 className="mb-3 font-heading text-20 max-md:text-ui-18 font-bold uppercase tracking-wide text-cons-accent">
            {t("consTitle")}
          </h3>
          <ul className="flex flex-col gap-2">
            {negative.map((note, index) => (
              <li key={index} className="flex gap-2 text-18 max-md:text-ui-16 text-muted-foreground">
                <X className="mt-1 h-4 w-4 shrink-0 text-cons-accent" aria-hidden />
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Tab "Thông số kĩ thuật" — bảng spec dạng HTML, đổi theo ngôn ngữ. HTML (V255 "Dán mã HTML") là
 *  nguồn render duy nhất — không còn bảng dòng có cấu trúc để fallback. */
export function ProductSpecsTable({ viSpecsHtml = "" }: { viSpecsHtml?: string }) {
  const t = useTranslations("Product");
  const locale = useLocale();
  const enSpecsHtml = useLocalizedField<string>("specifications");

  const [isExpanded, setIsExpanded] = useState(false);
  const [clamped, setClamped] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // "HTML thắng": có HTML (EN override khi đổi ngôn ngữ, hoặc bản vi) → render HTML đã sanitize.
  const specsHtml = locale === "en" ? enSpecsHtml : viSpecsHtml;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const checkHeight = () => {
      if (el.scrollHeight > 360) {
        setClamped(true);
      } else {
        setClamped(false);
      }
    };

    checkHeight();
    const timer = setTimeout(checkHeight, 150);
    return () => clearTimeout(timer);
  }, [specsHtml]);

  if (!specsHtml || !specsHtml.trim()) {
    return (
      <div className="thong-so-ki-thuat">
        <p>{t("specsEmpty")}</p>
      </div>
    );
  }

  const showMoreLabel = t("reviews.showMore") || (locale === "en" ? "Show more" : "Xem thêm");
  const showLessLabel = t("reviews.showLess") || (locale === "en" ? "Show less" : "Thu gọn");

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className={cn(
          "thong-so-ki-thuat overflow-x-auto overflow-y-hidden transition-[max-height] duration-500 ease-in-out relative",
          clamped ? (isExpanded ? "max-h-[3000px]" : "max-h-[280px]") : ""
        )}
      >
        <div dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(specsHtml, { allowInlineStyles: true }) }} />
        
        {clamped && (
          <div
            className={cn(
              "absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[var(--bb-bg-page)] via-[var(--bb-bg-page)]/95 to-transparent pointer-events-none transition-opacity duration-300",
              isExpanded ? "opacity-0" : "opacity-100"
            )}
          />
        )}
      </div>

      {clamped && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => setIsExpanded((v) => !v)}
            aria-expanded={isExpanded}
            className="flex items-center gap-1.5 border border-brand bg-[var(--bb-bg-page)] px-6 py-2.5 text-ui-14 font-cta font-bold uppercase tracking-wider text-brand transition-all duration-[var(--bb-duration-fast)] hover:bg-brand hover:text-white cursor-pointer outline-none focus-visible:outline-2 focus-visible:outline-ring"
          >
            {isExpanded ? (
              <>
                {showLessLabel}
                <ChevronUp className="h-4 w-4" aria-hidden="true" />
              </>
            ) : (
              <>
                {showMoreLabel}
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

/** Tab "Câu hỏi thường gặp" — accordion FAQ, đổi theo ngôn ngữ. */
export function ProductFaqs({ viFaqs }: { viFaqs: Faq[] }) {
  const t = useTranslations("Product");
  const locale = useLocale();
  const enFaqs = useLocalizedField<Faq[]>("faqs");
  const faqs = (locale === "en" ? enFaqs : viFaqs) ?? [];

  if (faqs.length === 0) {
    return (
      <div className={richContentClassName}>
        <p>{t("faqsEmpty")}</p>
      </div>
    );
  }

  return (
    <Accordion type="single" collapsible className="pdp-faq-accordion w-full border-t border-border">
      {faqs.map((faq, i) => (
        <AccordionItem key={i} value={`faq-${i}`}>
          <AccordionTrigger className="group gap-3 text-left normal-case hover:text-brand data-[state=open]:text-brand">
            <span className="flex min-w-0 flex-1 items-center gap-3">
              <span
                className="shrink-0 font-cta text-ui-18 max-md:text-ui-16 font-bold leading-snug tabular-nums text-muted-foreground transition-colors group-hover:text-brand group-data-[state=open]:text-brand"
                aria-hidden
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="text-ui-20 max-md:text-ui-18 font-semibold leading-snug">{faq.question}</span>
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div
              className={cn(richContentClassName, "pl-9 text-muted-foreground")}
              dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(faq.answer ?? "", { allowInlineStyles: true }) }}
            />
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

/** Tab "Mô tả" — HTML mô tả sản phẩm, đổi theo ngôn ngữ. */
export function ProductDescriptionTab({ viHtml }: { viHtml: string }) {
  const t = useTranslations("Product");
  const enHtml = useLocalizedField<unknown>("description");
  const locale = useLocale();
  const hasContent = locale === "en"
    ? typeof enHtml === "string" && enHtml.trim().length > 0
    : viHtml.trim().length > 0;
  if (!hasContent) {
    return (
      <div className={richContentClassName}>
        <p>{t("descriptionEmpty")}</p>
      </div>
    );
  }
  return <LHtml field="description" viHtml={viHtml} className={richContentClassName} rewriteMediaUrls />;
}


/** Nội dung dài SEO cuối trang (contentBottom) — rich HTML, đổi theo ngôn ngữ.
 *  Fallback về bản VI render sẵn ở server khi payload EN không có field này. */
export function ProductContentBottom({ viHtml }: { viHtml: string }) {
  return <LHtml field="contentBottom" viHtml={viHtml} className={richContentClassName} rewriteMediaUrls />;
}

// Phù hợp với ai · Bảng size (V246): KHỐI trong mô tả — render bởi SuitabilityBlockView /
// SizeGuideBlockView trong ProductDescriptionBlocks. Ưu/Nhược điểm (V251) tách RA thành khối riêng
// ngoài tab — xem ProductProsCons ở trên.

function getYouTubeId(url: string): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|v\/))([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

/**
 * Khối "Video sản phẩm" — dùng CHUNG carousel video của trang chủ (HomeVideoCarousel):
 * thumbnail lướt ngang, bấm vào mở popup phát video, mũi tên trắng đổ bóng rõ trên nền tối.
 * Chuyển VideoAsset (PDP) → HomeVideo: tách YouTube ID từ url; video file tự lưu (MinIO)
 * giữ ở videoUrl để popup phát bằng thẻ <video>.
 */
export function ProductVideosSection({ videos }: { videos: VideoAsset[] }) {
  const t = useTranslations("Product");

  if (videos.length === 0) {
    return (
      <div className={richContentClassName}>
        <p>{t("videosEmpty")}</p>
      </div>
    );
  }

  const homeVideos: HomeVideo[] = videos.map((v, i) => ({
    id: v.id ?? `pdp-video-${i}`,
    sortOrder: i,
    title: v.title ?? "",
    videoUrl: resolveMediaUrl(v.url?.trim()) ?? v.url ?? "",
    youtubeId: getYouTubeId(v.url ?? ""),
    embedUrl: null,
    autoThumbnailUrl: null,
    thumbnail: v.thumbnail ?? null,
  }));

  return <HomeVideoCarousel videos={homeVideos} surface="light" compact />;
}
