import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/catalog/ProductCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { MediaImage } from "@/components/ui/MediaImage";
import { PaginationNav } from "@/components/ui/PaginationNav";
import { PRODUCT_SORT_VALUES, getBrandBySlug, listProducts } from "@/lib/api/public-api";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { safeText } from "@/lib/utils/format";
import { buildQueryString, collectErrors, parsePositiveIntParam, parseSortParam } from "@/lib/utils/query";
import { toBrandPath } from "@/lib/utils/routes";
import { isValidSlug } from "@/lib/utils/slug";

type BrandDetailPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: BrandDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  if (!isValidSlug(slug)) {
    return buildPublicMetadata({
      title: "Thuong hieu khong hop le",
      description: "Slug thuong hieu khong hop le.",
      canonicalPath: toBrandPath("invalid"),
      noIndex: true,
    });
  }

  const brandResult = await getBrandBySlug(slug);
  const brand = brandResult.data;
  if (!brand) {
    return buildPublicMetadata({
      title: "Khong tim thay thuong hieu",
      description: "Khong tim thay thong tin thuong hieu yeu cau.",
      canonicalPath: toBrandPath(slug),
      noIndex: true,
    });
  }

  return buildPublicMetadata({
    title: brand.seo?.title ?? brand.name,
    description: brand.seo?.description ?? brand.description ?? "Chi tiet thuong hieu BigBike.",
    canonicalPath: brand.seo?.canonicalUrl ?? toBrandPath(brand.slug),
    noIndex: brand.seo?.noIndex ?? false,
  });
}

export default async function BrandDetailPage({ params, searchParams }: BrandDetailPageProps) {
  const { slug } = await params;
  if (!isValidSlug(slug)) {
    notFound();
  }

  const query = await searchParams;
  const pageParsed = parsePositiveIntParam(query.page, {
    defaultValue: 1,
    min: 1,
    max: 999,
    field: "page",
  });
  const sizeParsed = parsePositiveIntParam(query.size, {
    defaultValue: 12,
    min: 1,
    max: 100,
    field: "size",
  });
  const sortParsed = parseSortParam(query.sort, PRODUCT_SORT_VALUES, "createdAt:desc");
  const validationErrors = collectErrors(pageParsed.error, sizeParsed.error, sortParsed.error);

  if (validationErrors.length > 0) {
    return (
      <section className="bb-page">
        <div className="bb-container">
          <ErrorState message={validationErrors.join(" ")} />
        </div>
      </section>
    );
  }

  const [brandResult, productsResult] = await Promise.all([
    getBrandBySlug(slug),
    listProducts({
      page: pageParsed.value,
      size: sizeParsed.value,
      sort: sortParsed.value,
      brand: slug,
    }),
  ]);

  if (!brandResult.data && brandResult.error?.status === 404) {
    notFound();
  }
  if (!brandResult.data) {
    return (
      <section className="bb-page">
        <div className="bb-container">
          <ErrorState message={brandResult.error?.message ?? "Khong tai duoc thuong hieu."} />
        </div>
      </section>
    );
  }

  const brand = brandResult.data;

  return (
    <section className="bb-page">
      <div className="bb-container">
        <header>
          <p className="bb-kicker">Brand Detail</p>
          <h1>{safeText(brand.name, "Thuong hieu")}</h1>
          <p className="bb-page-subtitle">
            {safeText(brand.description, "Thong tin thuong hieu dang cap nhat.")}
          </p>
        </header>

        <section className="bb-section">
          <div className="bb-card" style={{ padding: "var(--bb-space-4)" }}>
            <MediaImage
              image={brand.logo}
              altFallback={safeText(brand.name, "Thuong hieu")}
              className="bb-category-image"
              width={1200}
              height={675}
            />
          </div>
        </section>

        {brandResult.fromFallback || productsResult.fromFallback ? (
          <p className="bb-status-banner">Dang hien thi du lieu fallback dev cho brand/product list.</p>
        ) : null}

        <section className="bb-section">
          <h2 className="bb-section-title">San pham theo thuong hieu</h2>
          {productsResult.error && productsResult.data.length === 0 ? (
            <ErrorState message={productsResult.error.message} />
          ) : productsResult.data.length === 0 ? (
            <EmptyState
              title="Thuong hieu chua co san pham"
              description="San pham cho thuong hieu nay dang duoc cap nhat."
            />
          ) : (
            <>
              <div className="bb-grid-products">
                {productsResult.data.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
              {productsResult.pagination ? (
                <PaginationNav
                  page={productsResult.pagination.page}
                  totalPages={productsResult.pagination.totalPages}
                makeHref={(nextPage) =>
                    `${toBrandPath(slug)}${buildQueryString({
                      page: nextPage,
                      size: sizeParsed.value,
                      sort: sortParsed.value,
                    })}`
                  }
                />
              ) : null}
            </>
          )}
        </section>
      </div>
    </section>
  );
}
