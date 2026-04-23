import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { MediaImage } from "@/components/ui/MediaImage";
import { PaginationNav } from "@/components/ui/PaginationNav";
import { BRAND_SORT_VALUES, listBrands } from "@/lib/api/public-api";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { safeText } from "@/lib/utils/format";
import { buildQueryString, collectErrors, parsePositiveIntParam, parseSortParam, readSingleSearchParam } from "@/lib/utils/query";
import { toBrandListPath, toBrandPath } from "@/lib/utils/routes";

type BrandListPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ searchParams }: BrandListPageProps): Promise<Metadata> {
  const params = await searchParams;
  const page = Number(readSingleSearchParam(params.page) ?? "1");
  const hasQueryVariant = page > 1 || Boolean(readSingleSearchParam(params.sort));

  return buildPublicMetadata({
    title: "Thương hiệu",
    description: "Danh sách thương hiệu theo route /brands/.",
    canonicalPath: toBrandListPath(),
    noIndex: hasQueryVariant,
  });
}

export default async function BrandListPage({ searchParams }: BrandListPageProps) {
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
  const sortParsed = parseSortParam(params.sort, BRAND_SORT_VALUES, "name:asc");
  const validationErrors = collectErrors(pageParsed.error, sizeParsed.error, sortParsed.error);

  if (validationErrors.length > 0) {
    return (
      <section className="bb-page">
        <div className="bb-container">
          <ErrorState title="Query chưa hợp lệ" message={validationErrors.join(" ")} retryHref={toBrandListPath()} />
        </div>
      </section>
    );
  }

  const result = await listBrands({
    page: pageParsed.value,
    size: sizeParsed.value,
    sort: sortParsed.value,
  });

  return (
    <section className="bb-page">
      <div className="bb-container">
        <header>
          <p className="bb-kicker">Brand</p>
          <h1>Thương hiệu</h1>
          <p className="bb-page-subtitle">Route legacy dang duoc preserve la /brands/{'{slug}'}.</p>
        </header>

        {result.fromFallback ? (
          <p className="bb-status-banner">Đang hiển thị dữ liệu fallback dev cho thương hiệu.</p>
        ) : null}

        {result.error && result.data.length === 0 ? (
          <ErrorState message={result.error.message} retryHref={toBrandListPath()} />
        ) : result.data.length === 0 ? (
          <EmptyState
            title="Không có thương hiệu"
            description="Danh sách thương hiệu hiện đang rỗng."
          />
        ) : (
          <>
            <div className="bb-grid-categories bb-section">
              {result.data.map((brand) => (
                <article key={brand.id} className="bb-card bb-card-hover">
                  <Link href={toBrandPath(brand.slug)} className="bb-category-card-link">
                    <MediaImage
                      image={brand.logo}
                      altFallback={safeText(brand.name, "Thương hiệu")}
                      className="bb-category-image"
                      width={1200}
                      height={675}
                    />
                    <div className="bb-category-body">
                      <h3>{safeText(brand.name, "Thương hiệu")}</h3>
                      <p>{safeText(brand.description, "Thông tin thương hiệu đang cập nhật.")}</p>
                    </div>
                  </Link>
                </article>
              ))}
            </div>
            {result.pagination ? (
              <PaginationNav
                page={result.pagination.page}
                totalPages={result.pagination.totalPages}
                makeHref={(nextPage) =>
                  `${toBrandListPath()}${buildQueryString({
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
