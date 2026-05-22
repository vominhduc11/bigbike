import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { listArticles, listContentCategories } from "@/lib/api/public-api";
import type { Article, ContentCategoryWithCount } from "@/lib/contracts/public";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import {
  buildQueryString,
  collectErrors,
  parsePositiveIntParam,
  parseSlugParam,
  parseTextParam,
  readSingleSearchParam,
} from "@/lib/utils/query";
import { toArticleListPath, toArticlePath, toHomePath } from "@/lib/utils/routes";
import { WpArticleImage } from "./WpArticleImage";

type ArticleListPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const DEFAULT_PAGE_SIZE = 12;
const CATEGORY_ORDER = ["khong-phan-loai", "reviews", "tin-tuc"];
const ROOT_CATEGORY_SLUG = "tin-tuc";
const BIGBIKE_UPLOADS_BASE = "https://bigbike.vn/wp-content/uploads/";
const LEGACY_CDN_PREFIX = "https://cdn.bigbike.vn/uploads/";
const WP_UPLOADS_PATH = "/wp-content/uploads/";
const MINIO_UPLOADS_SUBPATH = "/wp-uploads/";

const NEWS_INTRO =
  "Bên cạnh việc mang đến khách hàng những dòng mũ bảo hiểm chất lượng, BigBike còn thường xuyên cập nhật các thông tin hữu ích về xe máy, mũ bảo hiểm, phụ kiện và kinh nghiệm lái xe an toàn.";

const NEWS_OUTRO =
  "Qua những thông tin được BigBike chia sẻ, hy vọng khách hàng có thêm kiến thức để lựa chọn sản phẩm phù hợp và sử dụng xe an toàn hơn mỗi ngày. Xin chân thành cảm ơn quý khách đã theo dõi.";

export async function generateMetadata({ searchParams }: ArticleListPageProps): Promise<Metadata> {
  const [params, t] = await Promise.all([searchParams, getTranslations("Blog")]);
  const page = Number(readSingleSearchParam(params.paged ?? params.page) ?? "1");
  const hasFilters =
    page > 1 ||
    Boolean(readSingleSearchParam(params.q)) ||
    Boolean(readSingleSearchParam(params.category));

  return buildPublicMetadata({
    title: t("title"),
    description: t("metaDescription"),
    canonicalPath: toArticleListPath(),
    noIndex: hasFilters,
  });
}

export default async function ArticleListPage({ searchParams }: ArticleListPageProps) {
  const [params, t] = await Promise.all([
    searchParams,
    getTranslations("Blog"),
  ]);

  const pageParsed = parsePositiveIntParam(params.paged ?? params.page, {
    defaultValue: 1,
    min: 1,
    max: 999,
    field: "paged",
  });
  const sizeParsed = parsePositiveIntParam(params.size, {
    defaultValue: DEFAULT_PAGE_SIZE,
    min: 1,
    max: 100,
    field: "size",
  });
  const categoryParsed = parseSlugParam(
    params.category === "all" ? undefined : params.category,
    "category",
  );
  const qParsed = parseTextParam(params.q, 100);

  const validationErrors = collectErrors(
    pageParsed.error,
    sizeParsed.error,
    categoryParsed.error,
    qParsed.error,
  );

  if (validationErrors.length > 0) {
    return (
      <div className="bb-blog-listing-parity">
        <WpPageTitle title="Tin tức" />
        <div className="bb-wp-main-content">
          <div className="bb-container">
            <WpNoResults title={t("invalidQuery")} message={validationErrors.join(" ")} />
          </div>
        </div>
      </div>
    );
  }

  const [result, categoriesResult] = await Promise.all([
    listArticles({
      page: pageParsed.value,
      size: sizeParsed.value,
      sort: "publishedAt:desc",
      category: categoryParsed.value,
      q: qParsed.value,
    }),
    listContentCategories(),
  ]);

  const sidebarCategories = orderCategories(
    categoriesResult.data.filter((cat) => cat.articleCount > 0),
  );
  const activeCategory = sidebarCategories.find((cat) => cat.slug === categoryParsed.value);
  const pageTitle = activeCategory?.name ?? "Tin tức";
  const showNewsDescription = !categoryParsed.value || categoryParsed.value === ROOT_CATEGORY_SLUG;

  const makeListHref = (overrides: {
    page?: number;
    category?: string;
    size?: number;
  }) => {
    const nextPage = overrides.page && overrides.page > 1 ? overrides.page : undefined;
    const nextSize = overrides.size && overrides.size !== DEFAULT_PAGE_SIZE ? overrides.size : undefined;

    return `${toArticleListPath()}${buildQueryString({
      paged: nextPage,
      size: nextSize,
      category: overrides.category,
      q: qParsed.value,
    })}`;
  };

  return (
    <div className="bb-blog-listing-parity">
      <WpPageTitle title={pageTitle} />

      <div className="bb-wp-main-content">
        <div className="bb-container">
          {showNewsDescription ? (
            <div className="bb-wp-block-text bb-wp-block-text--top">
              <p>{NEWS_INTRO}</p>
              <p aria-hidden="true">&nbsp;</p>
            </div>
          ) : null}

          <div className="bb-wp-row">
            <aside className="bb-wp-sidebar" aria-label="Danh mục tin tức">
              <WpCategoryWidget
                categories={sidebarCategories}
                currentCategory={categoryParsed.value}
                makeListHref={makeListHref}
              />
            </aside>

            <section className="bb-wp-content-col" aria-label="Danh sách bài viết">
              {result.error && result.data.length === 0 ? (
                <WpNoResults title="Không thể tải bài viết" message={result.error.message} />
              ) : result.data.length === 0 ? (
                <WpNoResults title={t("emptyTitle")} message={t("emptyDescription")} />
              ) : (
                <>
                  <div className="bb-wp-news-list">
                    <div className="bb-wp-row">
                      {result.data.map((article) => (
                        <div key={article.id} className="bb-wp-card-col">
                          <WpArticleCard article={article} />
                        </div>
                      ))}
                    </div>
                  </div>

                  {result.pagination ? (
                    <WpPagination
                      page={result.pagination.page}
                      totalPages={result.pagination.totalPages}
                      makeHref={(page) =>
                        makeListHref({
                          page,
                          size: sizeParsed.value,
                          category: categoryParsed.value,
                        })
                      }
                    />
                  ) : null}
                </>
              )}
            </section>
          </div>

          {showNewsDescription ? (
            <div className="bb-wp-block-text bb-wp-block-text--bottom">
              <p aria-hidden="true">&nbsp;</p>
              <p>{NEWS_OUTRO}</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function WpPageTitle({ title }: { title: string }) {
  return (
    <section
      className="bb-wp-page-title"
      style={{ backgroundImage: "url('/wp/page-title-bg.png')" }}
    >
      <div className="bb-container">
        <div className="bb-wp-page-title-row">
          <div className="bb-wp-page-title-copy">
            <h1>{title}</h1>
            <nav className="bb-wp-breadcrumb" aria-label="Breadcrumb">
              <ul>
                <li>
                  <Link href={toHomePath()} className="home">
                    <span>Bigbike.vn</span>
                  </Link>
                </li>
                <li>
                  <span aria-current="page">{title}</span>
                </li>
              </ul>
            </nav>
          </div>
        </div>
        <div className="bb-wp-page-title-img text-right" aria-hidden="true">
          <Image src="/wp/mu-bao-hiem.png" alt="" width={420} height={300} priority />
        </div>
      </div>
    </section>
  );
}

function WpCategoryWidget({
  categories,
  currentCategory,
  makeListHref,
}: {
  categories: ContentCategoryWithCount[];
  currentCategory?: string;
  makeListHref: (overrides: { page?: number; category?: string; size?: number }) => string;
}) {
  if (categories.length === 0) {
    return null;
  }

  return (
    <div className="bb-wp-widget">
      <div className="bb-wp-widget-title">
        <h3>Danh mục tin tức</h3>
      </div>
      <div className="bb-wp-widget-body">
        <div className="bb-wp-product-category">
          <ul>
            {categories.map((cat) => {
              const href = cat.slug === ROOT_CATEGORY_SLUG
                ? toArticleListPath()
                : makeListHref({ category: cat.slug });
              const isCurrent = currentCategory
                ? currentCategory === cat.slug
                : cat.slug === ROOT_CATEGORY_SLUG;

              return (
                <li key={cat.id} className={isCurrent ? "current-cat" : undefined}>
                  <Link href={href}>
                    {cat.name}
                    <span className="count">
                      <span>{cat.articleCount}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

function WpArticleCard({ article }: { article: Article }) {
  const title = textOrFallback(article.title, "Bài viết");
  const excerpt = makeExcerpt(article);
  const publishedAt = formatWpDate(article.publishedAt ?? article.createdAt);
  const imageUrl = (article.coverImage ?? article.productImage)?.url;
  const imageSrc = resolveWpUploadUrl(imageUrl);
  const fallbackImageSrc = makeSlugThumbnailFallback(imageUrl, article.slug);

  return (
    <article className="bb-wp-news-item">
      <Link href={toArticlePath(article.slug)} className="bb-news-card">
        <span className="bb-news-img-wrap">
          <WpArticleImage src={imageSrc} fallbackSrc={fallbackImageSrc} alt={title} />
        </span>
        <span className="bb-news-body">
          {publishedAt ? <span className="bb-news-date">{publishedAt}</span> : null}
          <span className="bb-news-body-inside">
            <span className="bb-news-card-title">{title}</span>
            {excerpt ? <span className="bb-news-excerpt">{excerpt}</span> : null}
          </span>
        </span>
      </Link>
    </article>
  );
}

function WpPagination({
  page,
  totalPages,
  makeHref,
}: {
  page: number;
  totalPages: number;
  makeHref: (page: number) => string;
}) {
  if (totalPages <= 1) {
    return null;
  }

  const pages = buildWpPageItems(page, totalPages);

  return (
    <nav className="bb-wp-pagination" aria-label="Phân trang bài viết">
      <ul className="page-numbers">
        {page > 1 ? (
          <li>
            <Link className="prev page-numbers" href={makeHref(page - 1)} aria-label="Trang trước">
              <span aria-hidden="true">‹</span>
            </Link>
          </li>
        ) : null}
        {pages.map((item, index) => (
          <li key={`${item}-${index}`}>
            {item === "dots" ? (
              <span className="page-numbers dots">...</span>
            ) : item === page ? (
              <span aria-current="page" className="page-numbers current">
                {item}
              </span>
            ) : (
              <Link className="page-numbers" href={makeHref(item)}>
                {item}
              </Link>
            )}
          </li>
        ))}
        {page < totalPages ? (
          <li>
            <Link className="next page-numbers" href={makeHref(page + 1)} aria-label="Trang sau">
              <span aria-hidden="true">›</span>
            </Link>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}

function WpNoResults({ title, message }: { title: string; message: string }) {
  return (
    <section className="no-results not-found">
      <header className="page-header">
        <h2 className="page-title">{title}</h2>
      </header>
      <div className="page-content">
        <p>{message}</p>
      </div>
    </section>
  );
}

function orderCategories(categories: ContentCategoryWithCount[]) {
  return [...categories].sort((a, b) => {
    const aIndex = CATEGORY_ORDER.indexOf(a.slug);
    const bIndex = CATEGORY_ORDER.indexOf(b.slug);
    const aOrder = aIndex === -1 ? CATEGORY_ORDER.length : aIndex;
    const bOrder = bIndex === -1 ? CATEGORY_ORDER.length : bIndex;

    if (aOrder !== bOrder) {
      return aOrder - bOrder;
    }

    return a.name.localeCompare(b.name, "vi");
  });
}

function buildWpPageItems(page: number, totalPages: number): Array<number | "dots"> {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (page <= 2) {
    return [1, 2, "dots", totalPages];
  }

  if (page >= totalPages - 1) {
    return [1, "dots", totalPages - 1, totalPages];
  }

  return [1, "dots", page, "dots", totalPages];
}

function makeExcerpt(article: Article): string {
  const source = article.excerpt ?? article.body;
  const plain = stripHtml(source).replace(/\s+/g, " ").trim();

  if (!plain) {
    return "";
  }

  return plain.length > 180 ? `${plain.slice(0, 177).trim()}...` : plain;
}

function stripHtml(value: string | null | undefined): string {
  return (value ?? "").replace(/<[^>]*>/g, "");
}

function textOrFallback(value: string | null | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

function formatWpDate(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return "";
  }

  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

function resolveWpUploadUrl(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw) {
    return null;
  }

  if (raw.startsWith(LEGACY_CDN_PREFIX)) {
    return normalizeKnownWpUploadUrl(`${BIGBIKE_UPLOADS_BASE}${raw.slice(LEGACY_CDN_PREFIX.length)}`);
  }

  if (raw.startsWith(WP_UPLOADS_PATH)) {
    return normalizeKnownWpUploadUrl(`https://bigbike.vn${raw}`);
  }

  if (/^https:\/\/(?:www\.)?bigbike\.vn\/wp-content\/uploads\//.test(raw)) {
    return normalizeKnownWpUploadUrl(raw);
  }

  if (raw.startsWith("http") && raw.includes(MINIO_UPLOADS_SUBPATH)) {
    const idx = raw.indexOf(MINIO_UPLOADS_SUBPATH);
    return normalizeKnownWpUploadUrl(`${BIGBIKE_UPLOADS_BASE}${raw.slice(idx + MINIO_UPLOADS_SUBPATH.length)}`);
  }

  return raw;
}

function normalizeKnownWpUploadUrl(url: string): string {
  return url.replace(
    "/wp-content/uploads/2026/03/shop-mu-bao-hiem-gan-day-thumbnail.jpg",
    "/wp-content/uploads/2026/03/shop-non-bao-hiem-gan-day-thumbnail.jpg",
  );
}

function makeSlugThumbnailFallback(value: string | null | undefined, slug: string): string | null {
  const resolved = resolveWpUploadUrl(value);
  if (!resolved || !slug) {
    return null;
  }

  const match = resolved.match(/^(https:\/\/bigbike\.vn\/wp-content\/uploads\/\d{4}\/\d{2}\/)([^/?#]+)(\.[a-z0-9]+)([?#].*)?$/i);
  if (!match) {
    return null;
  }

  const [, basePath, fileName, extension] = match;
  const fallbackName = `${slug}-thumbnail`;
  if (fileName === fallbackName) {
    return null;
  }

  return `${basePath}${fallbackName}${extension}`;
}
