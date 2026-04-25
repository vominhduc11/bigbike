import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/catalog/ProductCard";
import { CatalogFilters } from "@/components/catalog/CatalogFilters";
import { CatalogSortSelect } from "@/components/catalog/CatalogSortSelect";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { MediaImage } from "@/components/ui/MediaImage";
import { PaginationNav } from "@/components/ui/PaginationNav";
import { PRODUCT_SORT_VALUES, getBrandBySlug, listBrands, listProducts } from "@/lib/api/public-api";
import { buildCatalogTitle } from "@/lib/utils/catalog";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { safeText } from "@/lib/utils/format";
import {
  buildQueryString,
  collectErrors,
  parseOptionalPositiveIntParam,
  parsePositiveIntParam,
  parseSlugParam,
  parseSortParam,
  parseTextParam,
  readSearchParamAlias,
  readSingleSearchParam,
} from "@/lib/utils/query";
import { toBrandPath, toHomePath, toBrandListPath } from "@/lib/utils/routes";
import { isValidSlug } from "@/lib/utils/slug";

type BrandDetailPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params, searchParams }: BrandDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  if (!isValidSlug(slug)) {
    return buildPublicMetadata({
      title: "Thương hiệu không hợp lệ",
      description: "Slug thương hiệu không hợp lệ.",
      canonicalPath: toBrandPath("invalid"),
      noIndex: true,
    });
  }

  const brandResult = await getBrandBySlug(slug);
  const brand = brandResult.data;
  if (!brand) {
    return buildPublicMetadata({
      title: "Không tìm thấy thương hiệu",
      description: "Không tìm thấy thông tin thương hiệu yêu cầu.",
      canonicalPath: toBrandPath(slug),
      noIndex: true,
    });
  }

  const query = await searchParams;
  const page = Number(readSearchParamAlias(query, "page", "paged") ?? "1");
  const brandFilter = readSearchParamAlias(query, "pwb-brand", "brand");
  const q = readSingleSearchParam(query.q);
  const gender = readSingleSearchParam(query.filter_gender);
  const color = readSingleSearchParam(query.filter_color);
  const minPrice = readSingleSearchParam(query.min_price);
  const maxPrice = readSingleSearchParam(query.max_price);

  return buildPublicMetadata({
    title:
      buildCatalogTitle(brand.seo?.title ?? brand.name, {
        page,
        gender,
        minPrice: minPrice ? Number(minPrice) : undefined,
        maxPrice: maxPrice ? Number(maxPrice) : undefined,
        colorName: color,
      }),
    description: brand.seo?.description ?? brand.description ?? "Chi tiết thương hiệu BigBike.",
    canonicalPath: brand.seo?.canonicalUrl ?? toBrandPath(brand.slug),
    noIndex:
      (brand.seo?.noIndex ?? false) ||
      page > 1 ||
      Boolean(brandFilter) ||
      Boolean(q) ||
      Boolean(gender) ||
      Boolean(color) ||
      Boolean(minPrice) ||
      Boolean(maxPrice),
  });
}

export default async function BrandDetailPage({ params, searchParams }: BrandDetailPageProps) {
  const { slug } = await params;
  if (!isValidSlug(slug)) {
    notFound();
  }

  const query = await searchParams;
  const pageParsed = parsePositiveIntParam(readSearchParamAlias(query, "page", "paged"), {
    defaultValue: 1,
    min: 1,
    max: 999,
    field: "page",
  });
  const sizeParsed = parsePositiveIntParam(query.size, {
    defaultValue: 24,
    min: 1,
    max: 100,
    field: "size",
  });
  const brandFilterParsed = parseSlugParam(readSearchParamAlias(query, "pwb-brand", "brand"), "pwb-brand");
  const qParsed = parseTextParam(query.q, 100);
  const colorParsed = parseSlugParam(query.filter_color, "filter_color");
  const genderParsed = parseSlugParam(query.filter_gender, "filter_gender");
  const minPriceParsed = parseOptionalPositiveIntParam(query.min_price, {
    min: 0,
    max: 1_000_000_000,
    field: "min_price",
  });
  const maxPriceParsed = parseOptionalPositiveIntParam(query.max_price, {
    min: 0,
    max: 1_000_000_000,
    field: "max_price",
  });
  const sortParsed = parseSortParam(query.sort, PRODUCT_SORT_VALUES, "createdAt:desc");
  const validationErrors = collectErrors(
    pageParsed.error,
    sizeParsed.error,
    brandFilterParsed.error,
    qParsed.error,
    colorParsed.error,
    genderParsed.error,
    minPriceParsed.error,
    maxPriceParsed.error,
    sortParsed.error,
  );

  if (validationErrors.length > 0) {
    return (
      <section className="bb-page">
        <div className="bb-container">
          <ErrorState message={validationErrors.join(" ")} />
        </div>
      </section>
    );
  }

  const [brandResult, productsResult, brandsResult] = await Promise.all([
    getBrandBySlug(slug),
    listProducts({
      page: pageParsed.value,
      size: sizeParsed.value,
      sort: sortParsed.value,
      brand: slug,
      q: qParsed.value,
      filterColor: colorParsed.value,
      filterGender: genderParsed.value,
      minPrice: minPriceParsed.value,
      maxPrice: maxPriceParsed.value,
    }),
    listBrands({ page: 1, size: 100, sort: "name:asc" }),
  ]);

  if (!brandResult.data && brandResult.error?.status === 404) {
    notFound();
  }
  if (!brandResult.data) {
    return (
      <section className="bb-page">
        <div className="bb-container">
          <ErrorState message={brandResult.error?.message ?? "Không tải được thông tin thương hiệu."} />
        </div>
      </section>
    );
  }

  const brand = brandResult.data;
  const canonicalPath = brand.seo?.canonicalUrl ?? toBrandPath(brand.slug);

  const brandName = safeText(brand.name, "Thương hiệu");
  const pagination = productsResult.pagination;
  const currentFilters = {
    q: qParsed.value,
    brand: brandFilterParsed.value,
    color: colorParsed.value,
    gender: genderParsed.value,
    minPrice: minPriceParsed.value,
    maxPrice: maxPriceParsed.value,
    sort: sortParsed.value,
  };

  return (
    <>
      <div className="wp-breadcrumb">
        <Link href={toHomePath()}>Trang chủ</Link>
        <span className="sep">/</span>
        <Link href={toBrandListPath()}>Thương hiệu</Link>
        <span className="sep">/</span>
        <span>{brandName}</span>
      </div>

      <div className="wp-page-head">
        <span className="kicker">Thương hiệu</span>
        <h1>{brandName}</h1>
        {brand.description && (
          <p style={{ color: "var(--bb-text-muted)", marginTop: 8, fontSize: 14 }}>{brand.description}</p>
        )}
      </div>

      {brand.logo && (
        <div style={{ maxWidth: 1440, margin: "0 auto 24px", padding: "0 24px" }}>
          <div style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 16 }}>
            <MediaImage
              image={brand.logo}
              altFallback={brandName}
              width={1200}
              height={400}
            />
          </div>
        </div>
      )}

      <div className="wp-cat-layout">
        <CatalogFilters
          brands={brandsResult.data}
          current={currentFilters}
          resetHref={canonicalPath}
        />

        <div>
          <div className="wp-catalog-head">
            <div className="wp-catalog-count">
              {productsResult.data.length > 0 && pagination ? (
                <>
                  Hiển thị{" "}
                  <b>
                    {(pagination.page - 1) * pagination.pageSize + 1}–
                    {Math.min(pagination.page * pagination.pageSize, pagination.totalItems)}
                  </b>{" "}
                  / {pagination.totalItems} sản phẩm
                </>
              ) : null}
            </div>
            <CatalogSortSelect current={sortParsed.value ?? "createdAt:desc"} />
          </div>

          {productsResult.error && productsResult.data.length === 0 ? (
            <ErrorState message={productsResult.error.message} retryHref={canonicalPath} />
          ) : productsResult.data.length === 0 ? (
            <EmptyState
              title="Thương hiệu chưa có sản phẩm"
              description="Sản phẩm cho thương hiệu này đang được cập nhật."
            />
          ) : (
            <>
              <div className="wp-product-grid">
                {productsResult.data.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
              {pagination ? (
                <PaginationNav
                  page={pagination.page}
                  totalPages={pagination.totalPages}
                  makeHref={(nextPage) =>
                    `${canonicalPath}${buildQueryString({
                      page: nextPage,
                      size: sizeParsed.value,
                      sort: sortParsed.value,
                      "pwb-brand": brandFilterParsed.value,
                      q: qParsed.value,
                      filter_color: colorParsed.value,
                      filter_gender: genderParsed.value,
                      min_price: minPriceParsed.value,
                      max_price: maxPriceParsed.value,
                    })}`
                  }
                />
              ) : null}
            </>
          )}
        </div>
      </div>
    </>
  );
}
