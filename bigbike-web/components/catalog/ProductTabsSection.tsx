"use client";

import type { ReactNode } from "react";

import { DescriptionBlocksView } from "@/components/catalog/ProductDescriptionBlocks";
import { WpProductTabs, type WpTab } from "@/components/wp/WpProductTabs";
import type { DescriptionBlock, ProductTab } from "@/lib/contracts/public";

/** Nội dung + nhãn mặc định của một tab builtin do ProductView cung cấp (đã gắn data sẵn). */
export type BuiltinTab = { id: string; labelKey: string; content: ReactNode };

/**
 * Khối tab PDP dựng theo CẤU HÌNH từng sản phẩm (V231). Tab builtin lấy nội dung từ `builtins[type]`
 * (đã chứa component + nhãn mặc định). Tab tự do (custom) render nội dung khối qua DescriptionBlocksView.
 * Tab bị tắt hoặc loại không khả dụng (vd reviews ở chế độ xem trước) bị bỏ.
 *
 * Cấu hình `tabs` được dùng NHƯ NHAU cho mọi ngôn ngữ: nhãn đổi ngữ qua i18n (labelKey), nội dung đổi
 * ngữ qua LocalizedContentProvider ở từng component con. Trước đây bản EN còn đọc thêm cấu hình tab đã
 * lưu của sản phẩm (`useLocalizedField("tabs")`) và đè lên, khiến số tab giữa VI/EN lệch nhau — đã gỡ.
 * Khi không có cấu hình (`tabs` rỗng) → dựng theo thứ tự mặc định, hiện mọi mục có nội dung.
 */
export function ProductTabsSection({
  tabs: config,
  builtins,
  defaultOrder,
  hideAnchorNav = false,
}: {
  /** Cấu hình tab của sản phẩm; rỗng → dùng thứ tự builtin mặc định. */
  tabs: ProductTab[];
  /** Map type builtin → nội dung; type vắng mặt nghĩa là không khả dụng (vd reviews khi preview). */
  builtins: Record<string, BuiltinTab>;
  /** Thứ tự builtin mặc định khi sản phẩm không có cấu hình riêng. */
  defaultOrder: string[];
  /** Ẩn thanh nav nhảy-mục riêng của khối tab (PDP dùng thanh nav tổng ở đầu trang). */
  hideAnchorNav?: boolean;
}) {
  let resolved: WpTab[];

  if (!Array.isArray(config) || config.length === 0) {
    // Mặc định: builtin theo thứ tự, dùng nhãn i18n.
    resolved = defaultOrder
      .map((type) => builtins[type])
      .filter((b): b is BuiltinTab => Boolean(b))
      .map((b) => ({ id: b.id, labelKey: b.labelKey, label: "", content: b.content }));
  } else {
    resolved = config
      .filter((t) => t.enabled !== false)
      .map((t, idx): WpTab | null => {
        if (t.type === "custom") {
          const blocks = (t.blocks ?? []) as DescriptionBlock[];
          if (blocks.length === 0) return null;
          return {
            id: t.id || `tab-custom-${idx}`,
            label: (t.label ?? "").trim() || "Thông tin",
            content: <DescriptionBlocksView blocks={blocks} />,
          };
        }
        const b = builtins[t.type];
        if (!b) return null; // builtin không khả dụng (vd reviews khi preview)
        const custom = (t.label ?? "").trim();
        return custom
          ? { id: b.id, label: custom, content: b.content }
          : { id: b.id, labelKey: b.labelKey, label: "", content: b.content };
      })
      .filter((t): t is WpTab => Boolean(t));
  }

  if (resolved.length === 0) return null;
  return <WpProductTabs tabs={resolved} hideAnchorNav={hideAnchorNav} />;
}
