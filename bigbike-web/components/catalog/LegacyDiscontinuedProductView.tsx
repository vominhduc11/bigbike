import Link from "@/i18n/StorefrontLink";
import { getTranslations } from "next-intl/server";

import { Container } from "@/components/layout/Container";
import { DiscontinuedStatusPanel } from "@/components/catalog/DiscontinuedStatusPanel";
import { DiscontinuedSuggestions } from "@/components/catalog/DiscontinuedSuggestions";
import { DiscontinuedTrustStrip } from "@/components/catalog/DiscontinuedTrustStrip";
import { LocalizedLink } from "@/components/i18n/LocalizedLink";
import { MediaImage } from "@/components/ui/MediaImage";
import type { BrandSummary, CategorySummary, LegacyDiscontinuedProduct, Product } from "@/lib/contracts/public";
import { resolveMediaUrl } from "@/lib/utils/format";
import { toHomePath } from "@/lib/utils/routes";
import type { Locale } from "@/i18n/locale";

export async function LegacyDiscontinuedProductView({
  entry,
  locale,
  breadcrumbCategories,
  brand,
  suggestions,
  zaloUrl,
}: {
  entry: LegacyDiscontinuedProduct;
  locale: Locale;
  breadcrumbCategories: CategorySummary[];
  brand?: BrandSummary | null;
  suggestions: Product[];
  zaloUrl?: string;
}) {
  const t = await getTranslations("Product");
  const tA11y = await getTranslations("A11y");
  const imageUrl = entry.imageUrl ? resolveMediaUrl(entry.imageUrl) : null;
  const categoryName = breadcrumbCategories[breadcrumbCategories.length - 1]?.name;
  const categorySlugEn = breadcrumbCategories[breadcrumbCategories.length - 1]?.slugEn;

  return (
    <main id="main-content" className="bb-heroless">
      <Container>
        <nav className="py-6 text-a5-meta text-muted-foreground md:py-8" aria-label={tA11y("breadcrumbNav")}>
          <ol className="m-0 flex list-none flex-wrap items-center gap-1 p-0">
            <li>
              <Link href={toHomePath(locale)} className="font-semibold hover:text-brand">
                {locale === "en" ? "Home" : "Trang chủ"}
              </Link>
            </li>
            {breadcrumbCategories.map((category) => (
              <li key={category.id} className="inline-flex items-center gap-1">
                <span aria-hidden="true">/</span>
                <LocalizedLink kind="category" viSlug={category.slug} enSlug={category.slugEn} className="font-semibold hover:text-brand">
                  {category.name}
                </LocalizedLink>
              </li>
            ))}
            <li className="inline-flex items-center gap-1" aria-current="page">
              <span aria-hidden="true">/</span>
              <span>{entry.name}</span>
            </li>
          </ol>
        </nav>

        <article
          className={imageUrl ? "grid items-start gap-8 pb-8 md:grid-cols-12" : "pb-8"}
          data-discontinued-history
        >
          {imageUrl ? (
            <div className="min-w-0 md:col-span-7">
              <MediaImage
                image={{ url: imageUrl, alt: entry.name }}
                altFallback={entry.name}
                width={1000}
                height={1000}
                preload
                sizes="(min-width: 1024px) 58vw, 100vw"
                className="h-auto max-h-[min(70vh,720px)] w-full object-contain"
              />
            </div>
          ) : null}
          <div className={imageUrl ? "min-w-0 md:col-span-5" : "w-full"}>
            <DiscontinuedStatusPanel
              name={entry.name}
              categorySlug={entry.categorySlug}
              categorySlugEn={categorySlugEn}
              categoryName={categoryName}
              brand={brand}
              brandName={entry.brandName}
              hasSuggestions={suggestions.length > 0}
              zaloUrl={zaloUrl}
            />
          </div>
        </article>

        <div className="space-y-8 pb-16 md:space-y-10">
          <DiscontinuedTrustStrip />
          <DiscontinuedSuggestions products={suggestions} />
          <p className="m-0 text-a5-meta leading-relaxed text-muted-foreground">{t("safetyDisclaimer")}</p>
        </div>
      </Container>
    </main>
  );
}
