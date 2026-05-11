import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/layout/PageHero";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { MediaImage } from "@/components/ui/MediaImage";
import { PaginationNav } from "@/components/ui/PaginationNav";
import { BRAND_SORT_VALUES, listBrands, listPublicSettings } from "@/lib/api/public-api";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { safeText } from "@/lib/utils/format";
import { readHeroSettings } from "@/lib/utils/page-hero";
import { buildQueryString, collectErrors, parsePositiveIntParam, parseSortParam, readSingleSearchParam } from "@/lib/utils/query";
import { toBrandListPath, toBrandPath, toHomePath } from "@/lib/utils/routes";

type BrandListPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ searchParams }: BrandListPageProps): Promise<Metadata> {
  const params = await searchParams;
  const page = Number(readSingleSearchParam(params.page) ?? "1");
  const hasQueryVariant = page > 1 || Boolean(readSingleSearchParam(params.sort));

  return buildPublicMetadata({
    title: "Thương hiệu",
    description: "Khám phá tất cả thương hiệu đồ bảo hộ biker tại BigBike — mũ bảo hiểm, áo giáp, găng tay và phụ kiện rider chính hãng.",
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

  const [result, settingsResult] = await Promise.all([
    listBrands({
      page: pageParsed.value,
      size: sizeParsed.value,
      sort: sortParsed.value,
    }),
    listPublicSettings(),
  ]);
  const heroSettings = readHeroSettings(settingsResult.data ?? [], "hero_brands");

  return (
    <section className="bb-page">
      <PageHero
        imageUrl={heroSettings.imageUrl}
        imageAlt={heroSettings.imageAlt}
        kicker={heroSettings.kicker ?? "BRAND"}
        title={heroSettings.title ?? "Thương hiệu"}
        description={
          heroSettings.description ?? "Tất cả thương hiệu đồ bảo hộ biker tại BigBike."
        }
        breadcrumb={[
          { label: "Trang chủ", href: toHomePath() },
          { label: "Thương hiệu" },
        ]}
        meta={result.pagination ? `${result.pagination.totalItems} thương hiệu` : undefined}
      />
      <div className="bb-container">

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
