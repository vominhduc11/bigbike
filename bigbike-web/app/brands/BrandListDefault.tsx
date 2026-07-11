import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CatalogPagination } from "@/components/catalog/CatalogPagination";
import type { Brand } from "@/lib/contracts/public";
import { resolveMediaUrl, safeText } from "@/lib/utils/format";
import { toBrandListPath, toBrandPath } from "@/lib/utils/routes";

/* eslint-disable @next/next/no-img-element */

type BrandPagination = {
  page: number;
  totalPages: number;
  totalItems?: number | null;
};

export async function BrandListDefault({
  brands,
  pagination,
}: {
  brands: Brand[];
  pagination?: BrandPagination | null;
}) {
  const t = await getTranslations("Catalog");

  if (brands.length === 0) {
    return <p className="border border-border bg-card p-4 text-ui-16 text-muted-foreground">{t("brandListEmpty")}</p>;
  }

  return (
    <>
      <div className="relative">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 3xl:grid-cols-6 4xl:grid-cols-7">
          {brands.map((brand) => {
            const name = safeText(brand.name, "Thuong hieu");
            const logoUrl = resolveMediaUrl(brand.logo?.url?.trim());
            const initials = name.replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase();
            return (
              <Link
                key={brand.id}
                href={toBrandPath(brand.slug)}
                title={name}
                className="group flex h-full flex-col items-center justify-between gap-4 border border-border bg-white p-5 no-underline transition-colors hover:border-foreground"
              >
                <span className="flex h-16 w-full items-center justify-center">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt={brand.logo?.alt ?? name}
                      className="max-h-16 w-auto max-w-full object-contain transition-transform duration-200 group-hover:scale-105"
                    />
                  ) : (
                    <span className="text-2xl font-bold tracking-wide text-muted-foreground">{initials}</span>
                  )}
                </span>
                <span className="text-center text-ui-14 font-semibold uppercase tracking-wide text-foreground">
                  {name}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
      {pagination ? (
        <CatalogPagination page={pagination.page} totalPages={pagination.totalPages} baseHref={toBrandListPath()} />
      ) : null}
    </>
  );
}
