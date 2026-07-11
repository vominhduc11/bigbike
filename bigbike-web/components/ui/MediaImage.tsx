import Image from "next/image";
import type { ImageAsset } from "@/lib/contracts/public";
import { safeText, resolveMediaUrl } from "@/lib/utils/format";

// Alt do WP import sinh ra phần lớn là tên file / mã tem, KHÔNG mô tả nội dung
// ảnh (checklist SEO #12 — "không đánh số 'Tem 01'"). Ví dụ thật trong DB:
// "Balo-di-mo-to-phuot-Kriega-R20-...-01", "1f7848...b5c8", "1 1 3", "sx- 1".
// Khi alt là rác máy sinh, bỏ qua và dùng fallback (tên sản phẩm) — vừa mô tả
// đúng entity vừa nhất quán toàn trang. Admin nhập alt thật sẽ luôn được giữ.
function isDescriptiveAlt(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  // Hash-like: mọi token đều là chuỗi hex dài (có thể có 1 ký tự dẫn đầu).
  const tokens = trimmed.split(/\s+/);
  if (tokens.every((t) => /^[a-z]?[0-9a-f]{12,}$/i.test(t))) return false;
  // Dạng slug/tên file: không có khoảng trắng nhưng có gạch nối/gạch dưới.
  if (!/\s/.test(trimmed) && /[-_]/.test(trimmed)) return false;
  // Không có ký tự chữ nào (toàn số/dấu, ví dụ "1 1 3").
  if (!/\p{L}/u.test(trimmed)) return false;
  // Quá ngắn để mô tả nội dung (ví dụ "sx").
  if (trimmed.replace(/[^\p{L}]/gu, "").length < 3) return false;
  return true;
}

type MediaImageProps = {
  image?: ImageAsset | null;
  altFallback: string;
  className?: string;
  width?: number;
  height?: number;
  /** Next.js 16 renamed next/image's `priority` prop to `preload` (`priority` is
   *  deprecated but still an alias) — named to match here. */
  preload?: boolean;
  loading?: "eager" | "lazy";
  /** Responsive sizes hint so next/image picks an appropriately scaled source
   *  for grid cells (without it, next/image assumes 100vw and over-fetches). */
  sizes?: string;
};

export function MediaImage({
  image,
  altFallback,
  className,
  width = 1200,
  height = 1200,
  preload = false,
  loading,
  sizes,
}: MediaImageProps) {
  const src = resolveMediaUrl(image?.url?.trim());
  const storedAlt = image?.alt;
  const alt =
    storedAlt && isDescriptiveAlt(storedAlt) ? storedAlt.trim() : safeText(altFallback, "");

  if (!src) {
    return (
      <div
        className={`flex w-full min-h-[200px] items-center justify-center border-b border-border bg-secondary p-4 text-center text-a5-meta text-muted-foreground ${className ?? ""}`}
        aria-label={alt}
      >
        <span>{alt}</span>
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={image?.width ?? width}
      height={image?.height ?? height}
      className={className}
      preload={preload}
      loading={preload ? "eager" : loading ?? "lazy"}
      sizes={sizes}
    />
  );
}
