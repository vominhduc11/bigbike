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
    <section className="bb-home-mobile-categories pt-6 pb-1">
      <MobileSectionHeader
        kicker="DANH MỤC"
        title="MUA SẮM THEO LOẠI"
        href={toProductListPath()}
      />
      <div className="bb-home-mobile-category-grid grid grid-cols-2 gap-2.5 px-3.5 min-[600px]:grid-cols-3">
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
              <div className="bb-home-mobile-category-image flex h-[96px] w-full items-center justify-center bg-white p-3 min-[600px]:h-[108px]">
                <span className="relative block h-[68px] w-[86px] min-[600px]:h-[76px] min-[600px]:w-[104px]">
                  <Image
                    src={src}
                    alt={name}
                    fill
                    sizes="(max-width: 599px) 86px, 104px"
                    className="object-contain"
                  />
                </span>
              </div>
              <div className="px-2.5 py-2">
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
