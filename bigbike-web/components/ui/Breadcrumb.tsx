import Link from "next/link";
import { cn } from "@/lib/utils";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export type BreadcrumbProps = {
  items: BreadcrumbItem[];
  /**
   * Biến thể hiển thị:
   * - `onLight` (mặc định) — đứng trên nền sáng, phía trên nội dung trang.
   * - `onHero` — chữ sáng đặt trên ảnh banner hero.
   */
  variant?: "onLight" | "onHero";
  className?: string;
};

/**
 * Breadcrumb dùng chung — gom logic render (link/last-item/separator) về một chỗ.
 * Style giữ ở 2 class legacy đã có: `bb-breadcrumb` (onLight) và
 * `bb-cat-hero-breadcrumb` (onHero) — không thêm CSS mới.
 */
export function Breadcrumb({ items, variant = "onLight", className }: BreadcrumbProps) {
  if (items.length === 0) {
    return null;
  }
  const isHero = variant === "onHero";

  return (
    <nav
      className={cn(isHero ? "bb-cat-hero-breadcrumb" : "bb-breadcrumb", className)}
      aria-label="Điều hướng"
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        // WP-parity: on mobile collapse to first + last only (hide the middle
        // crumbs and their separators) — WP @max-767 .breadcrumb li{display:none}
        // except first/last. Avoids hard-clipping a long chain on narrow hero banners.
        const isMiddle = index !== 0 && !isLast;
        return (
          <span key={`${item.label}-${index}`} className={cn("contents", isMiddle && "max-md:hidden")}>
            {index > 0 ? (
              <span className={isHero ? undefined : "sep"} aria-hidden="true">
                /
              </span>
            ) : null}
            {!isLast && item.href ? (
              <Link href={item.href}>{item.label}</Link>
            ) : (
              <span aria-current={isLast ? "page" : undefined}>{item.label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
