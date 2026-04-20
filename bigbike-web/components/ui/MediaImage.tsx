import Image from "next/image";
import type { ImageAsset } from "@/lib/contracts/public";
import { safeText } from "@/lib/utils/format";

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
  const src = image?.url?.trim();
  const alt = safeText(image?.alt, altFallback);

  if (!src) {
    return (
      <div className={`bb-image-fallback ${className ?? ""}`} aria-label={alt}>
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
      unoptimized
      priority={priority}
    />
  );
}

