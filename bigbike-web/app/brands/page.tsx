import type { Metadata } from "next";
import Link from "next/link";
import { getLocale } from "next-intl/server";
import { WpCategoryHero, type WpCategoryCrumb } from "@/components/wp/WpCategoryHero";
import { WpCategoryPagination } from "@/components/wp/WpCategoryPagination";
import { BRAND_SORT_VALUES, listBrands } from "@/lib/api/public-api";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { resolveMediaUrl, safeText, toLegacyWpMediaUrl } from "@/lib/utils/format";
import {
  buildQueryString,
  collectErrors,
  parsePositiveIntParam,
  parseSortParam,
  readSearchParamAlias,
  readSingleSearchParam,
} from "@/lib/utils/query";
import { toBrandListPath, toBrandPath, toHomePath } from "@/lib/utils/routes";

/* eslint-disable @next/next/no-img-element */

// 12 hãng/trang; phân trang số trang đồng bộ với trang sản phẩm (?paged=N).
const DEFAULT_PAGE_SIZE = 12;
const DEFAULT_SORT = "name:asc";

type BrandListPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ searchParams }: BrandListPageProps): Promise<Metadata> {
  const params = await searchParams;
  const page = Number(readSearchParamAlias(params, "paged", "page") ?? "1");
  const hasQueryVariant = page > 1 || Boolean(readSingleSearchParam(params.sort));

  return buildPublicMetadata({
    title: "Thương hiệu",
    description:
      "Khám phá tất cả thương hiệu đồ bảo hộ biker tại BigBike — mũ bảo hiểm, áo giáp, găng tay và phụ kiện rider chính hãng.",
    canonicalPath: toBrandListPath(),
    noIndex: hasQueryVariant,
  });
}

export default async function BrandListPage({ searchParams }: BrandListPageProps) {
  const params = await searchParams;
  const pageParsed = parsePositiveIntParam(
    readSearchParamAlias(params, "paged", "page"),
    { defaultValue: 1, min: 1, max: 999, field: "paged" },
  );
  const sizeParsed = parsePositiveIntParam(params.size, {
    defaultValue: DEFAULT_PAGE_SIZE,
    min: 1,
    max: 100,
    field: "size",
  });
  const sortParsed = parseSortParam(params.sort, BRAND_SORT_VALUES, DEFAULT_SORT);
  const validationErrors = collectErrors(pageParsed.error, sizeParsed.error, sortParsed.error);

  const locale = await getLocale();
  const [result] = await Promise.all([
    listBrands({
      page: pageParsed.value,
      size: sizeParsed.value,
      sort: sortParsed.value,
      lang: locale,
    }),
  ]);

  const heroBreadcrumb: WpCategoryCrumb[] = [
    { label: "Bigbike.vn", href: toHomePath() },
    { label: "Thương hiệu" },
  ];

  const brands = result.data;
  const pagination = result.pagination;
  const paginationBaseHref = `${toBrandListPath()}${buildQueryString({
    size: sizeParsed.value !== DEFAULT_PAGE_SIZE ? sizeParsed.value : undefined,
    sort: sortParsed.value !== DEFAULT_SORT ? sortParsed.value : undefined,
  })}`;

  return (
    <>
      <link
        rel="stylesheet"
        href="/wp-content/themes/bigbike/css/wp-theme-category.css?v=2"
        precedence="default"
      />

      <div className="archive tax-pwb-brand post-type-archive-product">
        <WpCategoryHero title="Thương hiệu" breadcrumb={heroBreadcrumb} />

        <div id="main-content">
          <div className="container">
            <div className="pwb-all-brands pt-40 pb-40">
              {validationErrors.length > 0 ? (
                <p className="woocommerce-info">{validationErrors.join(" ")}</p>
              ) : result.error && brands.length === 0 ? (
                <p className="woocommerce-info">{result.error.message}</p>
              ) : brands.length === 0 ? (
                <p className="woocommerce-info">Danh sách thương hiệu hiện đang rỗng.</p>
              ) : (
                <>
                  {/* Lưới card đồng đều: ô bằng nhau, logo căn giữa trong khung cố
                      định 64px (object-contain), tên hãng dưới đáy. */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                    {brands.map((brand) => {
                      const name = safeText(brand.name, "Thương hiệu");
                      const logoUrl = toLegacyWpMediaUrl(resolveMediaUrl(brand.logo?.url?.trim()));
                      const href = toBrandPath(brand.slug);
                      const initials = name.replace(/[^A-Za-zÀ-ỹ]/g, "").slice(0, 2).toUpperCase();
                      return (
                        <Link
                          key={brand.id}
                          href={href}
                          title={name}
                          className="group flex h-full flex-col items-center justify-between gap-4 border border-neutral-200 bg-white p-5 no-underline transition-colors hover:border-neutral-900"
                        >
                          <span className="flex h-16 w-full items-center justify-center">
                            {logoUrl ? (
                              <img
                                src={logoUrl}
                                alt={brand.logo?.alt ?? name}
                                className="max-h-16 w-auto max-w-full object-contain transition-transform duration-200 group-hover:scale-105"
                              />
                            ) : (
                              <span className="text-2xl font-bold tracking-wide text-neutral-300">
                                {initials}
                              </span>
                            )}
                          </span>
                          <span className="text-center text-sm font-semibold uppercase tracking-wide text-neutral-800">
                            {name}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                  {pagination ? (
                    <WpCategoryPagination
                      page={pagination.page}
                      totalPages={pagination.totalPages}
                      baseHref={paginationBaseHref}
                    />
                  ) : null}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
