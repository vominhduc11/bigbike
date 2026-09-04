import { MediaImage } from "@/components/ui/MediaImage";
import { formatVnd, resolveMediaUrl } from "@/lib/utils/format";

type SearchProductRowContentProps = {
  name: string;
  price?: { retailPrice?: number; salePrice?: number | null } | null;
  image?: { url?: string; alt?: string; width?: number | null; height?: number | null } | null;
};

/** Shared product presentation for both empty-query shortcuts and live results. */
export function SearchProductRowContent({ name, price, image }: SearchProductRowContentProps) {
  const imageUrl = resolveMediaUrl(image?.url);

  return (
    <>
      {imageUrl ? (
        <MediaImage
          image={{ ...image, url: imageUrl }}
          altFallback={name}
          width={48}
          height={48}
          sizes="48px"
          className="h-12 w-12 shrink-0 object-contain"
        />
      ) : (
        <div className="h-12 w-12 shrink-0 border border-border bg-secondary" aria-hidden />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-a5-meta font-medium text-foreground">{name}</span>
        <span className="text-a5-meta font-bold text-brand-on-dark">
          {formatVnd(price?.salePrice ?? price?.retailPrice)}
        </span>
      </div>
    </>
  );
}
