/**
 * "Phù hợp với ai" (V240) — field `suitabilityAdvisory` lưu JSON array các thẻ tư vấn
 * `[{ audience, advice, linkLabel?, linkUrl? }]`. Helper parse dùng chung cho cả server
 * (ProductView — gate hiển thị) lẫn client (ProductSuitability — render). Để ở module
 * thuần (KHÔNG "use client") để server component import an toàn, không vướng ranh giới RSC.
 */
export type SuitabilityCard = {
  audience?: string | null;
  advice?: string | null;
  linkLabel?: string | null;
  linkUrl?: string | null;
};

export function parseSuitabilityCards(raw: unknown): SuitabilityCard[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (card): card is SuitabilityCard => Boolean(card) && typeof card === "object",
    );
  } catch {
    return [];
  }
}

/** Thẻ "có nội dung" = có ít nhất đối tượng hoặc lời khuyên. */
export function hasSuitabilityContent(raw: unknown): boolean {
  return parseSuitabilityCards(raw).some(
    (card) => (card.audience ?? "").trim() || (card.advice ?? "").trim(),
  );
}
