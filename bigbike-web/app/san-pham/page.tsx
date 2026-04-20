import Link from "next/link";
import type { Metadata } from "next";
import { ProductCard } from "@/components/catalog/ProductCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { PaginationNav } from "@/components/ui/PaginationNav";
import {
  PRODUCT_SORT_VALUES,
  listProducts,
} from "@/lib/api/public-api";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { toProductListPath } from "@/lib/utils/routes";
import { buildQueryString, collectErrors, parsePositiveIntParam, parseSlugParam, parseSortParam, parseTextParam, readSingleSearchParam } from "@/lib/utils/query";

type ProductListPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ searchParams }: ProductListPageProps): Promise<Metadata> {
  const params = await searchParams;
  const page = Number(readSingleSearchParam(params.page) ?? "1");
  const hasFilters =
    Boolean(readSingleSearchParam(params.q)) ||
    Boolean(readSingleSearchParam(params.category)) ||
    Boolean(readSingleSearchParam(params.brand)) ||
    page > 1;

  return buildPublicMetadata({
    title: "San pham",
    description: "Danh sach san pham BigBike theo route legacy /san-pham/.",
    canonicalPath: toProductListPath(),
    noIndex: hasFilters,
  });
}

export default async function ProductListPage({ searchParams }: ProductListPageProps) {
  const params = await searchParams;

  const pageParsed = parsePositiveIntParam(params.page, {
    defaultValue: 1,
    min: 1,
    max: 999,
    field: "page",
  });
  const sizeParsed = parsePositiveIntParam(params.size, {
    defaultValue: 12,
    min: 1,
    max: 100,
    field: "size",
  });
  const categoryParsed = parseSlugParam(params.category, "category");
  const brandParsed = parseSlugParam(params.brand, "brand");
  const qParsed = parseTextParam(params.q, 100);
  const sortParsed = parseSortParam(params.sort, PRODUCT_SORT_VALUES, "createdAt:desc");

  const validationErrors = collectErrors(
    pageParsed.error,
    sizeParsed.error,
    categoryParsed.error,
    brandParsed.error,
    qParsed.error,
    sortParsed.error,
  );

  if (validationErrors.length > 0) {
    return (
      <section className="bb-page">
        <div className="bb-container">
          <ErrorState
            title="Query chua hop le"
            message={validationErrors.join(" ")}
            retryHref={toProductListPath()}
          />
        </div>
      </section>
    );
  }

  const result = await listProducts({
    page: pageParsed.value,
    size: sizeParsed.value,
    sort: sortParsed.value,
    category: categoryParsed.value,
    brand: brandParsed.value,
    q: qParsed.value,
  });

  const pagination = result.pagination;

  return (
    <section className="bb-page">
      <div className="bb-container">
        <header>
          <p className="bb-kicker">Catalog</p>
          <h1>San pham</h1>
          <p className="bb-page-subtitle">
            Loc theo category, brand, sort va keyword voi API read-only /api/v1/products.
          </p>
        </header>

        <form method="GET" className="bb-query-form">
          <div className="bb-query-row">
            <label className="bb-query-label">
              Tim kiem
              <input name="q" defaultValue={qParsed.value} className="bb-query-input" />
            </label>
            <label className="bb-query-label">
              Sort
              <select name="sort" defaultValue={sortParsed.value} className="bb-query-select">
                {PRODUCT_SORT_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label className="bb-query-label">
              Category slug
              <input
                name="category"
                defaultValue={categoryParsed.value}
                placeholder="mu-bao-hiem"
                className="bb-query-input"
              />
            </label>
            <label className="bb-query-label">
              Brand slug
              <input
                name="brand"
                defaultValue={brandParsed.value}
                placeholder="ls2"
                className="bb-query-input"
              />
            </label>
          </div>
          <div className="bb-section-row">
            <button className="bb-button bb-button-primary" type="submit">
              Ap dung
            </button>
            <Link href={toProductListPath()} className="bb-button bb-button-secondary">
              Reset
            </Link>
          </div>
        </form>

        {result.fromFallback ? (
          <p className="bb-status-banner">
            Dang hien thi du lieu fallback dev do backend chua phan hoi.
          </p>
        ) : null}

        {result.error && result.data.length === 0 ? (
          <ErrorState message={result.error.message} retryHref={toProductListPath()} />
        ) : result.data.length === 0 ? (
          <EmptyState
            title="Khong tim thay san pham"
            description="Thu doi bo loc hoac bo tu khoa tim kiem."
          />
        ) : (
          <>
            <div className="bb-grid-products">
              {result.data.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
            {pagination ? (
              <PaginationNav
                page={pagination.page}
                totalPages={pagination.totalPages}
                makeHref={(nextPage) =>
                  `${toProductListPath()}${buildQueryString({
                    page: nextPage,
                    size: sizeParsed.value,
                    sort: sortParsed.value,
                    category: categoryParsed.value,
                    brand: brandParsed.value,
                    q: qParsed.value,
                  })}`
                }
              />
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
