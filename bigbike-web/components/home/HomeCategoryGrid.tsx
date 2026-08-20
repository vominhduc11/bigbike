import { resolveMediaUrl, toLegacyWpMediaUrl } from "@/lib/utils/format";
import { LocalizedLink } from "@/components/i18n/LocalizedLink";
import { MediaImage } from "@/components/ui/MediaImage";
import type { Category } from "@/lib/contracts/public";

const HOME_CATEGORY_IMAGE_SIZES =
  "(min-width: 1200px) 300px, (min-width: 768px) calc((100vw - 64px) / 4), (min-width: 640px) calc((100vw - 48px) / 3), calc((100vw - 32px) / 2)";

/**
 * Lưới danh mục trang chủ — server render `vi` (initialCategories) cho SEO/ISR; khi khách
 * đổi sang EN thì refetch danh mục (showOnHomepage) theo lang ở client và thay tên. Giữ
 * nguyên dữ liệu và thứ tự do admin cấu hình.
 */
export function HomeCategoryGrid({ initialCategories }: { initialCategories: Category[] }) {
  const categories = initialCategories;
  if (categories.length === 0) return null;

  return (
    <div className="mb-10 mt-32 max-md:mt-18">
      <div data-home-category-grid className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
        {categories.map((c) => {
          const sourceImage = c.image ?? c.icon;
          const img = toLegacyWpMediaUrl(resolveMediaUrl(sourceImage?.url?.trim()));
          const responsiveImage = img && sourceImage ? { ...sourceImage, url: img } : null;
          const name = c.name.normalize("NFC");
          return (
            <div className="border border-border text-center" key={c.id}>
              <LocalizedLink
                kind="category"
                viSlug={c.slug}
                enSlug={c.slugEn}
                className="group relative flex h-72.5 items-center justify-center overflow-hidden bg-card before:absolute before:inset-0 before:content-[''] before:bg-[url('/brand/home/category-hover.jpg')] before:bg-cover before:bg-center before:opacity-0 before:transition-opacity before:duration-200 before:ease-standard hover:before:opacity-100 focus-visible:outline-2 focus-visible:outline-ring focus-visible:[outline-offset:-3px]"
              >
                <span className="relative z-[1] block w-full px-4">
                  <span className="block">
                    {responsiveImage ? (
                      <MediaImage
                        image={responsiveImage}
                        altFallback=""
                        width={600}
                        height={600}
                        sizes={HOME_CATEGORY_IMAGE_SIZES}
                        className="mx-auto h-auto max-h-40 w-auto max-w-full object-contain transition duration-300 group-hover:brightness-0 group-hover:invert"
                      />
                    ) : (
                      <MediaImage
                        image={{ url: "/brand/home/category-fallback.png", width: 50, height: 60 }}
                        altFallback=""
                        sizes="50px"
                        className="mx-auto h-auto max-h-40 w-auto max-w-full object-contain transition duration-300 group-hover:brightness-0 group-hover:invert"
                      />
                    )}
                  </span>
                  <span className="mt-7.5 block line-clamp-2 font-cta text-a4-content font-semibold normal-case leading-body text-foreground group-hover:text-white">{name}</span>
                </span>
              </LocalizedLink>
            </div>
          );
        })}
      </div>
    </div>
  );
}
