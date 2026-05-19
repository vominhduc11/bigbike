import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ContactInfoEntry = {
  /** Icon đặt cạnh nhãn — truyền icon đã set kích thước; KHÔNG cần set màu (component tô màu brand). */
  icon: ReactNode;
  label: string;
  /** Nội dung mục: text, nhiều dòng <p>, hoặc link. */
  content: ReactNode;
};

export type ContactInfoListProps = {
  entries: ContactInfoEntry[];
  /**
   * Biến thể bố cục:
   * - `columns` (mặc định) — lưới ngang nhiều cột, ngăn bằng divider; dùng trong section trang.
   * - `list` — danh sách dọc, mỗi mục một hàng gạch chân.
   */
  variant?: "columns" | "list";
  className?: string;
};

const COLUMN_COUNT_CLASS: Record<number, string> = {
  1: "md:grid-cols-1",
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
  4: "md:grid-cols-4",
};

/**
 * Danh sách thông tin liên hệ shop (địa chỉ / hotline / mạng xã hội...) dùng chung.
 * Gom phần khung lặp lại (icon + nhãn + divider/hàng) — nội dung cụ thể do trang truyền vào.
 */
export function ContactInfoList({ entries, variant = "columns", className }: ContactInfoListProps) {
  if (entries.length === 0) {
    return null;
  }

  if (variant === "list") {
    return (
      <ul className={cn("list-none p-0 m-0", className)}>
        {entries.map((entry) => (
          <li
            key={entry.label}
            className="flex gap-4 items-start py-5 border-b border-border first:pt-0"
          >
            <span className="flex shrink-0 text-brand mt-1" aria-hidden="true">
              {entry.icon}
            </span>
            <div className="min-w-0">
              <p className="font-display text-lg font-semibold text-foreground mb-1">
                {entry.label}
              </p>
              {entry.content}
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div
      className={cn(
        "grid grid-cols-1 divide-y divide-border md:divide-y-0 md:divide-x",
        COLUMN_COUNT_CLASS[entries.length] ?? "md:grid-cols-3",
        className,
      )}
    >
      {entries.map((entry) => (
        <div
          key={entry.label}
          className="py-6 first:pt-0 md:py-0 md:px-6 md:first:pl-0 md:last:pr-0"
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="flex text-brand" aria-hidden="true">
              {entry.icon}
            </span>
            <span className="font-display text-base font-semibold uppercase text-foreground">
              {entry.label}
            </span>
          </div>
          {entry.content}
        </div>
      ))}
    </div>
  );
}
