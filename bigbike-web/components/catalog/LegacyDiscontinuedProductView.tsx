/* eslint-disable @next/next/no-img-element */

import Link from "@/i18n/StorefrontLink";
import { getTranslations } from "next-intl/server";

import { Container } from "@/components/layout/Container";
import { PageHero } from "@/components/layout/PageHero";
import { LocalizedLink } from "@/components/i18n/LocalizedLink";
import { ProductCard } from "@/components/catalog/ProductCard";
import { listProducts } from "@/lib/api/public-api";
import { DEFAULT_PRODUCT_SORT } from "@/lib/constants/catalog";
import type { LegacyDiscontinuedProduct } from "@/lib/contracts/public";
import { resolveMediaUrl } from "@/lib/utils/format";
import { toHomePath } from "@/lib/utils/routes";
import type { Locale } from "@/i18n/locale";

export async function LegacyDiscontinuedProductView({
  entry,
  locale,
}: {
  entry: LegacyDiscontinuedProduct;
  locale: Locale;
}) {
  const t = await getTranslations("Product");
  const name = entry.name;
  const category = entry.categorySlug;
  const imageUrl = entry.imageUrl ? resolveMediaUrl(entry.imageUrl) : null;
  const suggestionsResult = await listProducts({
    page: 1,
    size: 3,
    sort: DEFAULT_PRODUCT_SORT,
    category,
    lang: locale,
  });
  const suggestions = suggestionsResult.data ?? [];

  return (
    <div>
      <PageHero
        title={name}
        breadcrumb={[
          { label: "Bigbike.vn", href: toHomePath(locale) },
          { label: name },
        ]}
      />
      <main id="main-content">
        <Container>
          <article className="mx-auto grid w-full gap-8 pb-16 md:grid-cols-2 md:items-start">
            <div className="flex min-h-64 items-center justify-center border border-border bg-muted p-4">
              {imageUrl ? (
                <img src={imageUrl} alt={name} loading="eager" className="max-h-120 w-full object-contain" />
              ) : (
                <p className="text-center text-a5-meta text-muted-foreground">{t("discontinuedNoImage")}</p>
              )}
            </div>
            <div className="space-y-6">
              <p className="m-0 inline-flex border border-brand px-3 py-2 text-a5-meta font-semibold uppercase tracking-wide text-brand">
                {t("discontinuedLabel")}
              </p>
              <h1 className="m-0 font-body text-a2-page font-semibold leading-title text-foreground">{name}</h1>
              {entry.brandName ? (
                <p className="m-0 text-a5-meta text-muted-foreground">
                  {t("brand")}: {entry.brandName}
                </p>
              ) : null}
              <p className="m-0 text-a4-content leading-relaxed text-muted-foreground">
                {t("discontinuedDescription")}
              </p>
              <p className="m-0 border-l-4 border-brand bg-muted px-4 py-3 text-a4-content font-semibold leading-relaxed text-foreground">
                {t("safetyDisclaimer")}
              </p>
              <div className="flex flex-wrap gap-4">
                <LocalizedLink
                  kind="category"
                  viSlug={category}
                  className="inline-flex min-h-11 items-center border border-brand bg-brand px-5 py-3 font-semibold text-primary-foreground no-underline!"
                >
                  {t("discontinuedCategoryLink")}
                </LocalizedLink>
                <Link
                  href={toHomePath(locale)}
                  className="inline-flex min-h-11 items-center border border-border px-5 py-3 font-semibold text-foreground no-underline! hover:border-brand hover:text-brand"
                >
                  {t("discontinuedHomeLink")}
                </Link>
              </div>
            </div>
          </article>
          {suggestions.length > 0 ? (
            <section aria-labelledby="discontinued-suggestions" className="border-t border-border pt-10">
              <h2 id="discontinued-suggestions" className="m-0 font-body text-a3-section font-semibold uppercase leading-title text-foreground">
                {t("discontinuedSuggestionsTitle")}
              </h2>
              <div className="mt-2 grid grid-cols-2 gap-x-5 md:grid-cols-3 md:gap-x-8">
                {suggestions.slice(0, 3).map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    imageSizes="(min-width: 1200px) 368px, (min-width: 768px) calc((100vw - 112px) / 3), calc((100vw - 52px) / 2)"
                  />
                ))}
              </div>
            </section>
          ) : null}
        </Container>
      </main>
    </div>
  );
}
