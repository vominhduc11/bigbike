import Link from "@/i18n/StorefrontLink";
import { getTranslations } from "next-intl/server";
import { CatalogPagination } from "@/components/catalog/CatalogPagination";
import type { Brand } from "@/lib/contracts/public";
import { resolveMediaUrl, safeText } from "@/lib/utils/format";
import { toBrandListPath, toBrandPath } from "@/lib/utils/routes";
import type { Locale } from "@/i18n/locale";
import { MediaImage } from "@/components/ui/MediaImage";

type BrandPagination = {
  page: number;
  totalPages: number;
  totalItems?: number | null;
};

export async function BrandListDefault({
  brands,
  pagination,
  locale,
}: {
  brands: Brand[];
  pagination?: BrandPagination | null;
  locale: Locale;
}) {
  const t = await getTranslations("Catalog");

  if (brands.length === 0) {
    return <p className="border border-border bg-card p-4 text-a4-content text-muted-foreground">{t("brandListEmpty")}</p>;
  }

  return (
    <>
      <div className="relative">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {brands.map((brand) => {
            const name = safeText(brand.name, t("brandsTitle"));
            const logoUrl = resolveMediaUrl(brand.logo?.url?.trim());
            const initials = name.replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase();
            return (
              <Link
                key={brand.id}
                href={toBrandPath(brand.slug, locale)}
                title={name}
                className="group flex h-full flex-col items-center justify-between gap-4 border border-border bg-white p-5 no-underline transition-colors hover:border-foreground"
              >
                <span className="flex h-16 w-full items-center justify-center">
                  {logoUrl ? (
                    <MediaImage
                      image={{ ...brand.logo, url: logoUrl }}
                      altFallback={name}
                      width={256}
                      height={128}
                      sizes="(min-width: 1024px) 160px, calc((100vw - 48px) / 2)"
                      className="max-h-16 w-auto max-w-full object-contain transition-transform duration-200 group-hover:scale-105"
                    />
                  ) : (
                    <span className="text-a2-page font-bold tracking-wide text-muted-foreground">{initials}</span>
                  )}
                </span>
                <span className="text-center font-body text-a5-meta font-semibold text-foreground">
                  {name}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
      {pagination ? (
        <CatalogPagination page={pagination.page} totalPages={pagination.totalPages} baseHref={toBrandListPath(locale)} />
      ) : null}
    </>
  );
}
