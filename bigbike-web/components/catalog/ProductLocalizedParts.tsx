"use client";

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
export function ProductSpecsTable({
  viSpecs,
  emptyLabel,
}: {
  viSpecs: Spec[];
  emptyLabel: string;
}) {
  const enSpecs = useLocalizedField<Spec[]>("specifications");
  const specs = Array.isArray(enSpecs) && enSpecs.length > 0 ? enSpecs : viSpecs;

  if (specs.length === 0) {
    return (
      <div className="thong-so-ki-thuat">
        <p>{emptyLabel}</p>
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
export function ProductFaqs({
  viFaqs,
  emptyLabel,
}: {
  viFaqs: Faq[];
  emptyLabel: string;
}) {
  const enFaqs = useLocalizedField<Faq[]>("faqs");
  const faqs = Array.isArray(enFaqs) && enFaqs.length > 0 ? enFaqs : viFaqs;

  if (faqs.length === 0) {
    return (
      <div className="wyswyg">
        <p>{emptyLabel}</p>
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
  return <LHtml field="description" viHtml={viHtml} className="wyswyg" />;
}
