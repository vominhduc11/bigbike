"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  Check,
  Droplets,
  Glasses,
  HardHat,
  Headphones,
  Lightbulb,
  Package,
  Plug,
  Settings2,
  ShieldCheck,
  Sparkles,
  Wind,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import { useLocalizedField } from "@/components/i18n/LocalizedContent";
import { LHtml } from "@/components/i18n/LocalizedContent";
import { Tr } from "@/components/i18n/Tr";
import { sanitizeRichHtml } from "@/lib/utils/html";
import type { ProductHighlight } from "@/lib/contracts/public";
import { parseSuitabilityCards } from "@/lib/utils/suitability";
import { parseInstallationGuide } from "@/lib/utils/installation";
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

/** Tab "Thông số kĩ thuật" — bảng spec, đổi theo ngôn ngữ. */
export function ProductSpecsTable({ viSpecs }: { viSpecs: Spec[] }) {
  const t = useTranslations("Product");
  const enSpecs = useLocalizedField<Spec[]>("specifications");
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
      <table className="shop_attributes w-full border-collapse text-body">
        <tbody>
          {specs.map((s, i) => (
            <tr key={i} className="border-b border-border last:border-b-0 even:bg-muted/30">
              <th
                scope="row"
                className="w-[38%] px-3.5 py-3.5 text-left align-top text-body font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {s.name}
              </th>
              <td className="px-3.5 py-3.5 align-top text-body text-foreground">{s.value}</td>
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
    <Accordion type="single" collapsible className="w-full border-t border-border">
      {faqs.map((faq, i) => (
        <AccordionItem key={i} value={`faq-${i}`}>
          <AccordionTrigger className="gap-3 normal-case hover:text-brand data-[state=open]:text-brand">
            <span className="flex min-w-0 flex-1 items-baseline gap-3">
              <span
                className="shrink-0 font-cta text-ui-18 font-bold leading-none tabular-nums text-brand"
                aria-hidden
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="text-15 font-semibold leading-snug">{faq.question}</span>
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

// Bộ icon dựng sẵn cho các bước "Hướng dẫn lắp đặt" (V242) — admin chọn theo key, web map ra
// lucide. Web KHÔNG nạp Font Awesome nên phải dùng lucide. Key lạ/rỗng → Wrench (mặc định).
// Đồng bộ với INSTALL_ICON_OPTIONS bên admin (ProductDetailScreen.jsx).
const INSTALL_ICON_MAP: Record<string, LucideIcon> = {
  wrench: Wrench,
  glasses: Glasses,
  wind: Wind,
  "hard-hat": HardHat,
  headphones: Headphones,
  sparkles: Sparkles,
  "shield-check": ShieldCheck,
  settings: Settings2,
  droplets: Droplets,
  package: Package,
  plug: Plug,
};

/**
 * Khối "Hướng dẫn lắp đặt" (V242) — field `installationGuide` lưu JSON object
 * `{ steps: [{ icon, title, body, tip?, warning? }], maintenance? }`. Đọc bản EN từ
 * `LocalizedContentProvider` (mirror theo index) nếu có nội dung, fallback về JSON `vi` render
 * sẵn ở server. Mỗi bước: số thứ tự + icon + tiêu đề + nội dung + hộp mẹo (💡) / cảnh báo (⚠️);
 * cuối khối có ghi chú bảo dưỡng. Lưới 2 cột trên desktop, 1 cột mobile.
 */
export function ProductInstallationGuide({ viJson }: { viJson: string | null }) {
  const t = useTranslations("Product");
  const enGuide = parseInstallationGuide(useLocalizedField<unknown>("installationGuide"));
  const viGuide = parseInstallationGuide(viJson);
  const enHasContent =
    enGuide.steps.some((s) => (s.title ?? "").trim() || (s.body ?? "").trim()) ||
    enGuide.maintenance.trim().length > 0;
  const guide = enHasContent ? enGuide : viGuide;

  // icon dùng chung cả vi/en: khi dùng bản EN mà bước thiếu icon thì lấy từ bản VI cùng index.
  const steps = guide.steps
    .map((s, i) => ({ ...s, icon: (s.icon ?? "").trim() || (viGuide.steps[i]?.icon ?? "").trim() }))
    .filter((s) => (s.title ?? "").trim() || (s.body ?? "").trim());
  const maintenance = guide.maintenance.trim();

  if (steps.length === 0 && !maintenance) {
    return (
      <div className="wyswyg">
        <p>{t("installationEmpty")}</p>
      </div>
    );
  }

  const stepLabel = t("installationStepLabel");

  return (
    <div>
      {steps.length > 0 && (
        <div className="grid gap-px border border-border bg-border sm:grid-cols-2">
          {steps.map((step, index) => {
            const Icon = INSTALL_ICON_MAP[(step.icon ?? "").trim()] ?? Wrench;
            const title = (step.title ?? "").trim();
            const body = (step.body ?? "").trim();
            const tip = (step.tip ?? "").trim();
            const warning = (step.warning ?? "").trim();
            return (
              <div key={index} className="flex flex-col bg-background p-6">
                <div className="mb-3 flex items-center gap-2 font-cta text-body font-bold uppercase tracking-wide text-brand">
                  <span>
                    {stepLabel} {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="h-px flex-1 bg-border" aria-hidden />
                </div>
                <Icon className="mb-3 h-7 w-7 text-foreground" aria-hidden />
                {title && (
                  <h3 className="mb-2 font-heading text-h3 font-bold uppercase tracking-wide text-foreground">
                    {title}
                  </h3>
                )}
                {body && <p className="text-body-lg leading-relaxed text-muted-foreground">{body}</p>}
                {tip && (
                  <div className="mt-3 flex gap-2 border-l-[3px] border-l-brand bg-secondary px-3 py-2.5 text-15 leading-snug text-muted-foreground">
                    <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" aria-hidden />
                    <span>
                      <strong className="font-semibold text-foreground">{t("installationTipLabel")}:</strong> {tip}
                    </span>
                  </div>
                )}
                {warning && (
                  <div className="mt-3 flex gap-2 border-l-[3px] border-l-state-warning bg-state-warning-bg px-3 py-2.5 text-15 leading-snug text-state-warning-text">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-state-warning" aria-hidden />
                    <span>
                      <strong className="font-semibold">{t("installationWarningLabel")}:</strong> {warning}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {maintenance && (
        <div
          className={`flex items-start gap-3.5 border border-border bg-secondary p-5 ${
            steps.length > 0 ? "border-t-0" : ""
          }`}
        >
          <Wrench className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden />
          <div>
            <p className="mb-1 font-heading text-caption font-bold uppercase tracking-wide text-foreground">
              {t("installationMaintenanceTitle")}
            </p>
            <p className="text-body leading-relaxed text-muted-foreground">{maintenance}</p>
          </div>
        </div>
      )}
    </div>
  );
}

/** Nội dung dài SEO cuối trang (contentBottom) — rich HTML, đổi theo ngôn ngữ.
 *  Fallback về bản VI render sẵn ở server khi payload EN không có field này. */
export function ProductContentBottom({ viHtml }: { viHtml: string }) {
  return <LHtml field="contentBottom" viHtml={viHtml} className="wyswyg" />;
}

/**
 * Khối "Ưu điểm / Nhược điểm" — đọc bản EN từ `LocalizedContentProvider`
 * (positiveNotes / negativeNotes) nếu có, fallback về props `vi` render sẵn ở server,
 * giống các khối dịch được khác (PRODUCT_RULE_002 fallback field-by-field).
 */
export function ProductProsCons({
  viPositive,
  viNegative,
}: {
  viPositive: string[];
  viNegative: string[];
}) {
  const enPositive = useLocalizedField<ProductHighlight[]>("positiveNotes");
  const enNegative = useLocalizedField<ProductHighlight[]>("negativeNotes");
  const toLines = (notes: ProductHighlight[] | undefined, fallback: string[]) =>
    Array.isArray(notes) && notes.length > 0
      ? notes.map((n) => (n.content ?? "").trim()).filter(Boolean)
      : fallback;
  const positive = toLines(enPositive, viPositive);
  const negative = toLines(enNegative, viNegative);

  if (positive.length === 0 && negative.length === 0) return null;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {positive.length > 0 && (
        <div className="border-t-2 border-t-pros-accent bg-pros-accent/[0.07] p-5">
          <h2 className="mb-3 font-heading text-h4 font-bold uppercase tracking-wide text-pros-accent"><Tr ns="Product" k="prosTitle" /></h2>
          <ul className="flex flex-col gap-2">
            {positive.map((note, index) => (
              <li key={index} className="flex gap-2 text-foreground">
                <Check className="mt-1 h-4 w-4 shrink-0 text-pros-accent" aria-hidden />
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {negative.length > 0 && (
        <div className="border-t-2 border-t-cons-accent bg-cons-accent/[0.06] p-5">
          <h2 className="mb-3 font-heading text-h4 font-bold uppercase tracking-wide text-cons-accent"><Tr ns="Product" k="consTitle" /></h2>
          <ul className="flex flex-col gap-2">
            {negative.map((note, index) => (
              <li key={index} className="flex gap-2 text-muted-foreground">
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

/**
 * Khối "Phù hợp với ai" (V240) — danh sách thẻ tư vấn lưu trong field `suitabilityAdvisory`
 * dưới dạng JSON array `[{ audience, advice, linkLabel?, linkUrl? }]`. Đọc bản EN từ
 * `LocalizedContentProvider` (mirror theo index) nếu có, fallback về JSON `vi` render sẵn ở
 * server. Mỗi thẻ: đối tượng (in đậm) + lời khuyên + link gợi ý nội bộ tùy chọn.
 */
export function ProductSuitability({ viJson }: { viJson: string | null }) {
  const enCards = parseSuitabilityCards(useLocalizedField<unknown>("suitabilityAdvisory"));
  const viCards = parseSuitabilityCards(viJson);
  const cards = enCards.length > 0 ? enCards : viCards;
  const visible = cards.filter(
    (card) => (card.audience ?? "").trim() || (card.advice ?? "").trim(),
  );
  if (visible.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {visible.map((card, index) => {
        const audience = (card.audience ?? "").trim();
        const advice = (card.advice ?? "").trim();
        const linkLabel = (card.linkLabel ?? "").trim();
        const linkUrl = (card.linkUrl ?? "").trim();
        const hasLink = Boolean(linkLabel && linkUrl);
        return (
          // Một dòng chảy theo mockup: đối tượng in đậm → lời khuyên (+ link gợi ý) cùng đoạn,
          // viền trái đỏ, nền xám nhạt. Tự xuống dòng khi dài.
          <p
            key={index}
            className="border-l-4 border-l-brand bg-secondary px-4 py-3 leading-relaxed text-muted-foreground"
          >
            {audience && <strong className="font-bold text-foreground">{audience}</strong>}
            {audience && (advice || hasLink) && <span> → </span>}
            {advice && <span>{advice}</span>}
            {hasLink && (
              <>
                {advice && " "}
                <Link href={linkUrl} className="font-medium text-brand hover:underline">
                  {linkLabel}
                </Link>
              </>
            )}
          </p>
        );
      })}
    </div>
  );
}
