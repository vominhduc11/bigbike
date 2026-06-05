import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { ProductCard } from "@/components/catalog/ProductCard";
import { ProductArchiveHero } from "@/components/catalog/ProductArchiveHero";
import { PaginationNav } from "@/components/ui/PaginationNav";
import { listProducts } from "@/lib/api/public-api";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { buildQueryString, parsePositiveIntParam, parseTextParam, readSearchParamAlias } from "@/lib/utils/query";
import { toHomePath } from "@/lib/utils/routes";

const SEARCH_PATH = "/tim-kiem/";
const DEFAULT_PAGE_SIZE = 10;

type SearchPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ searchParams }: SearchPageProps): Promise<Metadata> {
  const [params, t] = await Promise.all([searchParams, getTranslations("Search")]);
  const q = readSearchParamAlias(params, "s", "q");
  return buildPublicMetadata({
    title: q ? `${q} - Bigbike.vn` : t("title"),
    description: t("metaDescription"),
    canonicalPath: SEARCH_PATH,
    noIndex: true,
    ogType: "article",
  });
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const [params, t, tBreadcrumb] = await Promise.all([
    searchParams,
    getTranslations("Search"),
    getTranslations("Breadcrumb"),
  ]);
  const qParsed = parseTextParam(readSearchParamAlias(params, "s", "q"), 200);
  const pageParsed = parsePositiveIntParam(readSearchParamAlias(params, "paged", "page"), {
    defaultValue: 1,
    min: 1,
    max: 999,
    field: "paged",
  });

  const query = qParsed.value?.trim() ?? "";
  const heroTitle = query ? `Kết quả tìm kiếm: “${query}”` : t("title");
  const page = pageParsed.value;

  return (
    <div className="bb-product-archive bb-search-results-page search search-results">
      <ProductArchiveHero
        title={heroTitle}
        breadcrumb={[
          { label: tBreadcrumb("home"), href: toHomePath() },
          { label: heroTitle },
        ]}
      />

      <div id="main-content" className="page_search bb-search-main">
        <div className="container bb-wp-container">
          <div className="row bb-wp-row bb-search-row">
            <div className="bb-search-content">
              <div className="product-list pb-40">
                <div className="container bb-search-inner-container">
                  <div className="product-list-filter headroom bb-search-toolbar">
                    <div className="row align-items-center bb-wp-row">
                      <div className="woocommerce-notices-wrapper" />
                    </div>
                  </div>
                  <div className="product-count" />
                  <div className="product">
                    {query.length === 0 || qParsed.error || pageParsed.error ? (
                      <p className="woocommerce-info">
                        {qParsed.error || pageParsed.error || "Không tìm thấy sản phẩm nào khớp với lựa chọn của bạn."}
                      </p>
                    ) : (
                      <SearchResults query={query} page={page} />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

async function SearchResults({ query, page }: { query: string; page: number }) {
  const locale = await getLocale();
  const result = await listProducts({
    page,
    size: DEFAULT_PAGE_SIZE,
    q: query,
    lang: locale,
  });

  if (result.error && result.data.length === 0) {
    return <p className="woocommerce-info">{result.error.message}</p>;
  }

  if (result.data.length === 0) {
    return <p className="woocommerce-info">Không tìm thấy sản phẩm nào khớp với lựa chọn của bạn.</p>;
  }

  const pagination = result.pagination;

  return (
    <>
      <div className="row bb-wp-row bb-search-product-row">
        {result.data.map((product) => (
          <div key={product.id} className="col-md-3 col-6 bb-wp-col-md-3 bb-wp-col-6 bb-search-product-col">
            <ProductCard product={product} variant="archive" />
          </div>
        ))}
      </div>

      {pagination ? (
        <PaginationNav
          page={pagination.page}
          totalPages={pagination.totalPages}
          baseHref={`${SEARCH_PATH}${buildQueryString({ s: query })}`}
          variant="archive"
        />
      ) : null}
    </>
  );
}
