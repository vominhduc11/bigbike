import Link from "next/link";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { ProductCard } from "@/components/catalog/ProductCard";
import { ProductArchiveHero } from "@/components/catalog/ProductArchiveHero";
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
  const breadcrumbCurrent = query ? `Search results for '${query}'` : t("breadcrumb");
  const page = pageParsed.value;

  return (
    <div className="bb-product-archive bb-search-results-page search search-results">
      <ProductArchiveHero
        title={heroTitle}
        breadcrumb={[
          { label: tBreadcrumb("home"), href: toHomePath() },
          { label: breadcrumbCurrent },
        ]}
      />

      <div id="main-content" className="page_search bb-search-main">
        <div className="container bb-wp-container">
          <div className="row bb-wp-row bb-search-row">
            <div className="col-md-9 bb-wp-col-md-9 bb-search-content">
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
        <SearchPagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          query={query}
        />
      ) : null}
    </>
  );
}

function SearchPagination({
  page,
  totalPages,
  query,
}: {
  page: number;
  totalPages: number;
  query: string;
}) {
  if (totalPages <= 1) return null;

  const pages = buildSearchPageList(page, totalPages);
  const hrefFor = (nextPage: number) =>
    `${SEARCH_PATH}${buildQueryString({
      s: query,
      paged: nextPage > 1 ? nextPage : undefined,
    })}`;

  return (
    <div className="pagination pb-40 pt-20 bb-archive-pagination bb-search-pagination">
      <div className="text-right">
        <div className="paginate-links">
          <ul className="page-numbers">
            {page > 1 ? (
              <li>
                <Link className="prev page-numbers" href={hrefFor(page - 1)} aria-label="Trang trước">
                  <i className="fal fa-angle-left" aria-hidden="true" />
                </Link>
              </li>
            ) : null}
            {pages.map((item, index) => (
              <li key={item === "..." ? `dots-${index}` : item}>
                {item === "..." ? (
                  <span className="page-numbers dots">&hellip;</span>
                ) : item === page ? (
                  <span aria-current="page" className="page-numbers current">
                    {item}
                  </span>
                ) : (
                  <Link className="page-numbers" href={hrefFor(item)}>
                    {item}
                  </Link>
                )}
              </li>
            ))}
            {page < totalPages ? (
              <li>
                <Link className="next page-numbers" href={hrefFor(page + 1)} aria-label="Trang sau">
                  <i className="fal fa-angle-right" aria-hidden="true" />
                </Link>
              </li>
            ) : null}
          </ul>
        </div>
      </div>
    </div>
  );
}

function buildSearchPageList(page: number, totalPages: number): (number | "...")[] {
  if (totalPages <= 3) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  if (page <= 2) {
    return [1, 2, "...", totalPages];
  }

  if (page >= totalPages - 1) {
    return [1, "...", totalPages - 1, totalPages];
  }

  return [1, "...", page, "...", totalPages];
}
