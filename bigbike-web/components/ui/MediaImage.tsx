import Image from "next/image";
import type { ImageAsset } from "@/lib/contracts/public";
import { safeText, resolveMediaUrl } from "@/lib/utils/format";

type MediaImageProps = {
  image?: ImageAsset | null;
  altFallback: string;
  className?: string;
  width?: number;
  height?: number;
  priority?: boolean;
};

export function MediaImage({
  image,
  altFallback,
  className,
  width = 1200,
  height = 1200,
  priority = false,
}: MediaImageProps) {
  const src = resolveMediaUrl(image?.url?.trim());
  const alt = safeText(image?.alt, altFallback);

  if (!src) {
    return (
      <div
        className={`flex w-full min-h-[200px] items-center justify-center border-b border-border bg-secondary p-4 text-center text-sm text-muted-foreground ${className ?? ""}`}
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
      priority={priority}
    />
  );
}
