import Image from "next/image";
import Link from "next/link";
import type { Category } from "@/lib/contracts/public";
import { resolveMediaUrl, safeText } from "@/lib/utils/format";
import { toCategoryPath, toProductListPath } from "@/lib/utils/routes";
import { MobileSectionHeader } from "./MobileSectionHeader";

export function MobileCategoryGrid({ categories }: { categories: Category[] }) {
  const items = categories.slice(0, 6);
  if (items.length === 0) return null;

  return (
    <section className="bb-home-mobile-categories pt-7 pb-2">
      <MobileSectionHeader
        kicker="DANH MỤC"
        title="MUA SẮM THEO LOẠI"
        href={toProductListPath()}
      />
      <div className="bb-home-mobile-category-grid grid grid-cols-2 gap-2.5 px-3.5">
        {items.map((category) => {
          const imgAsset = category.image ?? category.icon;
          const src = resolveMediaUrl(imgAsset?.url?.trim()) || "/wp/category-fallback.png";
          const name = safeText(category.name, "Danh mục");
          return (
            <Link
              key={category.id}
              href={toCategoryPath(category.slug)}
              className="bb-home-mobile-category-card block overflow-hidden border border-border bg-card"
            >
              <div className="bb-home-mobile-category-image relative aspect-[4/3] w-full bg-white">
                <Image
                  src={src}
                  alt={name}
                  fill
                  sizes="(max-width: 767px) 50vw"
                  className="object-contain p-3"
                />
              </div>
              <div className="p-2.5">
                <div className="line-clamp-2 min-h-[2.25rem] font-cta text-sm font-semibold uppercase leading-tight text-foreground">
                  {name}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
