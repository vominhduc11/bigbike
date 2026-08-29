import Link from "@/i18n/StorefrontLink";
import { getTranslations } from "next-intl/server";
import { CatalogPagination } from "@/components/catalog/CatalogPagination";
import type { Brand } from "@/lib/contracts/public";
import { resolveMediaUrl, safeText } from "@/lib/utils/format";
import { toBrandListPath, toBrandPath } from "@/lib/utils/routes";
import type { Locale } from "@/i18n/locale";
import { BrandLogo } from "@/components/catalog/BrandLogo";

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
    return (
      <p className="border border-border bg-card p-4 text-a4-content text-muted-foreground">
        {t("brandListEmpty")}
      </p>
    );
  }

  return (
    <>
      <div className="relative">
        <div data-brand-list-grid className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {brands.map((brand) => {
            const name = safeText(brand.name, t("brandsTitle"));
            const logoUrl = resolveMediaUrl(brand.logo?.url?.trim());
            return (
              <Link
                key={brand.id}
                href={toBrandPath(brand.slug, locale)}
                title={name}
                className="group flex h-full flex-col items-center justify-between gap-4 border border-border bg-white p-5 no-underline transition-colors hover:border-foreground"
              >
                <BrandLogo
                  name={name}
                  image={logoUrl && brand.logo ? { ...brand.logo, url: logoUrl } : null}
                  variant="list"
                  className="transition-transform duration-200 group-hover:scale-105"
                />
                <span className="text-center font-body text-a5-meta font-semibold text-foreground">
                  {name}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
      {pagination ? (
        <CatalogPagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          baseHref={toBrandListPath(locale)}
        />
      ) : null}
    </>
  );
}
