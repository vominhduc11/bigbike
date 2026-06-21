"use client";

import { useTranslations } from "next-intl";
import { Check, X } from "lucide-react";
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

type Spec = { name?: string | null; value?: string | null };
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
  const enPos = useLocalizedField<ProductHighlight[]>("positiveNotes");
  const enNeg = useLocalizedField<ProductHighlight[]>("negativeNotes");
  const positive = highlightLines(Array.isArray(enPos) && enPos.length > 0 ? enPos : positiveNotes);
  const negative = highlightLines(Array.isArray(enNeg) && enNeg.length > 0 ? enNeg : negativeNotes);
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

/** Tab "Thông số kĩ thuật" — bảng spec, đổi theo ngôn ngữ.
 *  V255: nếu có `specificationsHtml` ("Dán mã HTML"), render HTML đó THAY bảng dòng ("html thắng"). */
export function ProductSpecsTable({ viSpecs, viSpecsHtml = "" }: { viSpecs: Spec[]; viSpecsHtml?: string }) {
  const t = useTranslations("Product");
  const enSpecs = useLocalizedField<Spec[]>("specifications");
  const enSpecsHtml = useLocalizedField<string>("specificationsHtml");

  // "HTML thắng": có HTML (EN override khi đổi ngôn ngữ, hoặc bản vi) → render HTML đã sanitize,
  // bỏ qua bảng dòng tên/giá trị.
  const specsHtml =
    typeof enSpecsHtml === "string" && enSpecsHtml.trim() ? enSpecsHtml : viSpecsHtml;
  if (specsHtml && specsHtml.trim()) {
    return (
      <div
        className="thong-so-ki-thuat overflow-x-auto"
        dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(specsHtml) }}
      />
    );
  }

  const specs = Array.isArray(enSpecs) && enSpecs.length > 0 ? enSpecs : viSpecs;

  if (specs.length === 0) {
    return (
      <div className="thong-so-ki-thuat">
        <p>{t("specsEmpty")}</p>
      </div>
    );
  }

  return (
    <div className="thong-so-ki-thuat overflow-x-auto">
      <table className="shop_attributes w-full border-collapse text-ui-18 max-md:text-ui-16">
        <tbody>
          {specs.map((s, i) => (
            <tr key={i} className="border-b border-border last:border-b-0 even:bg-muted/30">
              <th
                scope="row"
                className="w-[38%] px-3.5 py-3.5 text-left align-top font-barlow font-semibold uppercase tracking-wide text-muted-foreground md:pl-0"
              >
                {s.name}
              </th>
              <td className="px-3.5 py-3.5 align-top text-foreground">{s.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Tab "Câu hỏi thường gặp" — accordion FAQ, đổi theo ngôn ngữ. */
export function ProductFaqs({ viFaqs }: { viFaqs: Faq[] }) {
  const t = useTranslations("Product");
  const enFaqs = useLocalizedField<Faq[]>("faqs");
  const faqs = Array.isArray(enFaqs) && enFaqs.length > 0 ? enFaqs : viFaqs;

  if (faqs.length === 0) {
    return (
      <div className="wyswyg">
        <p>{t("faqsEmpty")}</p>
      </div>
    );
  }

  return (
    <Accordion type="single" collapsible className="pdp-faq-accordion w-full border-t border-border">
      {faqs.map((faq, i) => (
        <AccordionItem key={i} value={`faq-${i}`}>
          <AccordionTrigger className="group gap-3 normal-case hover:text-brand data-[state=open]:text-brand">
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
              className="wyswyg pl-9 text-muted-foreground"
              dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(faq.answer ?? "") }}
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
  const hasEn = typeof enHtml === "string" && enHtml.trim().length > 0;
  if (!hasEn && viHtml.trim().length === 0) {
    return (
      <div className="wyswyg">
        <p>{t("descriptionEmpty")}</p>
      </div>
    );
  }
  return <LHtml field="description" viHtml={viHtml} className="wyswyg" />;
}


/** Nội dung dài SEO cuối trang (contentBottom) — rich HTML, đổi theo ngôn ngữ.
 *  Fallback về bản VI render sẵn ở server khi payload EN không có field này. */
export function ProductContentBottom({ viHtml }: { viHtml: string }) {
  return <LHtml field="contentBottom" viHtml={viHtml} className="wyswyg" />;
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
      <div className="wyswyg">
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
