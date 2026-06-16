"use client";

import { useTranslations } from "next-intl";
import { useLocalizedField } from "@/components/i18n/LocalizedContent";
import { LHtml } from "@/components/i18n/LocalizedContent";

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
    <div className="thong-so-ki-thuat">
      <table className="shop_attributes">
        <tbody>
          {specs.map((s, i) => (
            <tr key={i}>
              <th>{s.name}</th>
              <td>{s.value}</td>
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
    <div className="flex flex-col gap-0">
      {faqs.map((faq, i) => (
        <details key={i} className="group border-b border-border first:border-t">
          <summary className="flex justify-between items-start gap-3 py-3.5 font-semibold text-foreground cursor-pointer list-none [&::-webkit-details-marker]:hidden after:content-['+'] after:shrink-0 after:text-xl after:font-normal after:text-muted-foreground after:leading-none group-[[open]]:after:content-['−']">
            {faq.question}
          </summary>
          <div className="pb-3.5 text-muted-foreground">{faq.answer}</div>
        </details>
      ))}
    </div>
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

/** Tab "Hướng dẫn lắp đặt" — rich HTML, đổi theo ngôn ngữ; có trạng thái rỗng
 *  giống các tab khác để luôn hiện trong thanh tab dù admin chưa nhập. */
export function ProductInstallationTab({ viHtml }: { viHtml: string }) {
  const t = useTranslations("Product");
  const enHtml = useLocalizedField<unknown>("installationGuide");
  const hasEn = typeof enHtml === "string" && enHtml.trim().length > 0;
  if (!hasEn && viHtml.trim().length === 0) {
    return (
      <div className="wyswyg">
        <p>{t("installationEmpty")}</p>
      </div>
    );
  }
  return <LHtml field="installationGuide" viHtml={viHtml} className="wyswyg" />;
}

/** Nội dung dài SEO cuối trang (contentBottom) — rich HTML, đổi theo ngôn ngữ.
 *  Fallback về bản VI render sẵn ở server khi payload EN không có field này. */
export function ProductContentBottom({ viHtml }: { viHtml: string }) {
  return <LHtml field="contentBottom" viHtml={viHtml} className="wyswyg" />;
}
