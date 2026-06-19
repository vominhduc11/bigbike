// "Hiển thị trên web" (V245) — admin bật/tắt từng section của trang chi tiết sản phẩm (PDP).
// Backend lưu opaque JSON string `{sectionKey: boolean}` trên Product.sectionVisibility; web parse ở đây.
//
// Ngữ nghĩa gate: một section CHỈ hiện khi vừa CÓ nội dung VỪA không bị admin tắt.
//   • key = false        → admin tắt   → ẩn (dù có nội dung).
//   • key = true         → admin bật   → hiện nếu có nội dung.
//   • key thiếu/undefined → chưa cấu hình (sản phẩm cũ) → giữ hành vi legacy = hiện theo nội dung.
// Nhờ vậy sản phẩm cũ (map null) không đổi gì cho tới khi admin lưu lại với map explicit.

export type SectionVisibility = Record<string, boolean>;

export function parseSectionVisibility(raw?: string | null): SectionVisibility {
  if (typeof raw !== "string" || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: SectionVisibility = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === "boolean") out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

/** true khi section được phép hiện (chưa bị admin tắt). Vẫn cần kết hợp điều kiện "có nội dung". */
export function isSectionVisible(map: SectionVisibility, key: string): boolean {
  return map[key] !== false;
}
