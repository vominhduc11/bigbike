import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/catalog/ProductCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { PaginationNav } from "@/components/ui/PaginationNav";
import { PRODUCT_SORT_VALUES, getCategoryBySlug, listProducts } from "@/lib/api/public-api";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { buildQueryString, collectErrors, parsePositiveIntParam, parseSortParam } from "@/lib/utils/query";
import { toCategoryPath } from "@/lib/utils/routes";
import { isValidSlug } from "@/lib/utils/slug";
import { safeText } from "@/lib/utils/format";

type CategoryDetailPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: CategoryDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  if (!isValidSlug(slug)) {
    return buildPublicMetadata({
      title: "Danh muc khong hop le",
      description: "Slug danh muc khong hop le.",
      canonicalPath: toCategoryPath("invalid"),
      noIndex: true,
    });
  }

  const categoryResult = await getCategoryBySlug(slug);
  const category = categoryResult.data;
  if (!category) {
    return buildPublicMetadata({
      title: "Khong tim thay danh muc",
      description: "Khong tim thay danh muc san pham yeu cau.",
      canonicalPath: toCategoryPath(slug),
      noIndex: true,
    });
  }

  return buildPublicMetadata({
    title: category.seo?.title ?? category.name,
    description: category.seo?.description ?? category.description ?? "Chi tiet danh muc san pham BigBike.",
    canonicalPath: category.seo?.canonicalUrl ?? toCategoryPath(category.slug),
    noIndex: category.seo?.noIndex ?? false,
  });
}

export default async function CategoryDetailPage({
  params,
  searchParams,
}: CategoryDetailPageProps) {
  const { slug } = await params;
  if (!isValidSlug(slug)) {
    notFound();
  }

  const pageParams = await searchParams;
  const pageParsed = parsePositiveIntParam(pageParams.page, {
    defaultValue: 1,
    min: 1,
    max: 999,
    field: "page",
  });
  const sizeParsed = parsePositiveIntParam(pageParams.size, {
    defaultValue: 12,
    min: 1,
    max: 100,
    field: "size",
  });
  const sortParsed = parseSortParam(pageParams.sort, PRODUCT_SORT_VALUES, "createdAt:desc");

  const validationErrors = collectErrors(pageParsed.error, sizeParsed.error, sortParsed.error);
  if (validationErrors.length > 0) {
    return (
      <section className="bb-page">
        <div className="bb-container">
          <ErrorState title="Query chua hop le" message={validationErrors.join(" ")} />
        </div>
      </section>
    );
  }

  const [categoryResult, productsResult] = await Promise.all([
    getCategoryBySlug(slug),
    listProducts({
      page: pageParsed.value,
      size: sizeParsed.value,
      sort: sortParsed.value,
      category: slug,
    }),
  ]);

  if (!categoryResult.data && categoryResult.error?.status === 404) {
    notFound();
  }

  if (!categoryResult.data) {
    return (
      <section className="bb-page">
        <div className="bb-container">
          <ErrorState message={categoryResult.error?.message ?? "Khong tai duoc category detail."} />
        </div>
      </section>
    );
  }

  const category = categoryResult.data;

  return (
    <section className="bb-page">
      <div className="bb-container">
        <header>
          <p className="bb-kicker">Category Detail</p>
          <h1>{safeText(category.name, "Danh muc")}</h1>
          <p className="bb-page-subtitle">
            {safeText(category.description, "Chi tiet danh muc dang duoc cap nhat.")}
          </p>
        </header>

        {categoryResult.fromFallback || productsResult.fromFallback ? (
          <p className="bb-status-banner">
            Dang hien thi du lieu fallback dev cho category/product listing.
          </p>
        ) : null}

        {productsResult.error && productsResult.data.length === 0 ? (
          <ErrorState message={productsResult.error.message} />
        ) : productsResult.data.length === 0 ? (
          <EmptyState
            title="Danh muc chua co san pham"
            description="Danh muc nay hien tai chua co san pham publish."
          />
        ) : (
          <>
            <div className="bb-grid-products bb-section">
              {productsResult.data.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
            {productsResult.pagination ? (
              <PaginationNav
                page={productsResult.pagination.page}
                totalPages={productsResult.pagination.totalPages}
                makeHref={(nextPage) =>
                  `${toCategoryPath(slug)}${buildQueryString({
                    page: nextPage,
                    size: sizeParsed.value,
                    sort: sortParsed.value,
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
