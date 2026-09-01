import type { ImageAsset } from "@/lib/contracts/public";
import { MediaImage } from "@/components/ui/MediaImage";
import { cn } from "@/lib/utils";

export type BrandLogoVariant = "home" | "list" | "detail" | "about";

const FRAME_CLASSES: Record<BrandLogoVariant, string> = {
  // Trang chủ: dải logo 2 cột trên mobile (88px vừa khít), 5 cột từ 767px.
  // Từ 992px trở lên mỗi ô rộng ~154-208px nên khung 88px trông lọt thỏm —
  // nâng lên 128px, vẫn dư lề trong ô hẹp nhất (~154px) nên không tràn.
  home: "size-22 min-[992px]:size-32",
  list: "size-24",
  detail: "size-48 md:size-80",
  about: "size-32",
};

function initialsFor(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2)
    return `${Array.from(words[0])[0] ?? ""}${Array.from(words[1])[0] ?? ""}`.toUpperCase();
  return Array.from(name.trim()).slice(0, 2).join("").toUpperCase();
}
export function BrandLogo({
  name,
  image,
  variant,
  className,
}: {
  name: string;
  image?: ImageAsset | null;
  variant: BrandLogoVariant;
  className?: string;
}) {
  const initials = initialsFor(name);
  const hasImage = Boolean(image?.url?.trim());

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center aspect-square text-center",
        FRAME_CLASSES[variant],
        className,
      )}
      data-brand-logo="true"
      aria-label={name}
    >
      {hasImage ? (
        <MediaImage
          image={image}
          altFallback={name}
          width={320}
          height={320}
          sizes={
            variant === "detail"
              ? "320px"
              : variant === "home"
                ? "(min-width: 992px) 128px, 88px"
                : variant === "list"
                  ? "96px"
                  : "128px"
          }
          className="h-full w-full object-contain"
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center bg-secondary px-2 text-a3-section font-bold tracking-wide text-muted-foreground">
          {initials}
        </span>
      )}
    </span>
  );
}
