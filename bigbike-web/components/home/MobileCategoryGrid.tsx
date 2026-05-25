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
    <section className="pt-7 pb-2">
      <MobileSectionHeader
        kicker="DANH MỤC"
        title="MUA SẮM THEO LOẠI"
        href={toProductListPath()}
      />
      <div className="grid grid-cols-2 gap-2.5 px-3.5">
        {items.map((category) => {
          const imgAsset = category.image ?? category.icon;
          const src = resolveMediaUrl(imgAsset?.url?.trim()) || "/wp/category-fallback.png";
          const name = safeText(category.name, "Danh mục");
          return (
            <Link
              key={category.id}
              href={toCategoryPath(category.slug)}
              className="border border-border overflow-hidden block"
            >
              <div className="relative h-[130px] w-full">
                <Image
                  src={src}
                  alt={name}
                  fill
                  sizes="(max-width: 767px) 50vw"
                  className="object-cover"
                />
              </div>
              <div className="p-2.5">
                <div className="font-cta text-sm uppercase font-semibold text-foreground leading-tight">
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
