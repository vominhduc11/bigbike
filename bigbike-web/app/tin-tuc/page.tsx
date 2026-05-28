import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHero } from "@/components/layout/PageHero";
import { listArticles, listContentCategories, listPublicSettings } from "@/lib/api/public-api";
import type { Article, ContentCategoryWithCount } from "@/lib/contracts/public";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { readHeroSettings } from "@/lib/utils/page-hero";
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
const ROOT_CATEGORY_SLUG = "tin-tuc";
const BIGBIKE_UPLOADS_BASE = "https://bigbike.vn/wp-content/uploads/";
const LEGACY_CDN_PREFIX = "https://cdn.bigbike.vn/uploads/";
const WP_UPLOADS_PATH = "/wp-content/uploads/";
const MINIO_UPLOADS_SUBPATH = "/wp-uploads/";
const WP_EXCERPT_WORDS = 20;

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
  const [params, t, tBreadcrumb] = await Promise.all([
    searchParams,
    getTranslations("Blog"),
    getTranslations("Breadcrumb"),
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
        <PageHero
          title={t("title")}
          breadcrumb={[
            { label: tBreadcrumb("home"), href: toHomePath() },
            { label: t("breadcrumb") },
          ]}
        />
        <div id="main-content" className="bb-wp-main-content">
          <div className="bb-container container">
            <WpNoResults query={qParsed.value} />
          </div>
        </div>
      </div>
    );
  }

  const [result, categoriesResult, settingsResult] = await Promise.all([
    listArticles({
      page: pageParsed.value,
      size: sizeParsed.value,
      sort: "publishedAt:desc",
      category: categoryParsed.value,
      q: qParsed.value,
    }),
    listContentCategories(),
    listPublicSettings(),
  ]);

  const sidebarCategories = categoriesResult.data.filter((cat) => cat.articleCount > 0);
  const heroSettings = readHeroSettings(settingsResult.data ?? [], "hero_news");
  const activeCategory = sidebarCategories.find((cat) => cat.slug === categoryParsed.value);
  const basePageTitle = activeCategory?.name ?? heroSettings.title ?? "Tin tức";
  const pageTitle =
    pageParsed.value > 1 ? `${basePageTitle} - Trang ${pageParsed.value}` : basePageTitle;

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
      <PageHero
        title={pageTitle}
        imageUrl={heroSettings.imageUrl}
        imageAlt={heroSettings.imageAlt}
        breadcrumb={
          activeCategory
            ? [
                { label: tBreadcrumb("home"), href: toHomePath() },
                { label: t("breadcrumb"), href: toArticleListPath() },
                { label: activeCategory.name },
              ]
            : [
                { label: tBreadcrumb("home"), href: toHomePath() },
                { label: t("breadcrumb") },
              ]
        }
      />

      <div id="main-content" className="bb-wp-main-content">
        <div className="bb-container container">
          <div className="bb-wp-row row">
            <aside className="bb-wp-sidebar col-md-3" aria-label="Danh mục tin tức">
              <WpCategoryWidget categories={sidebarCategories} />
            </aside>

            <section className="bb-wp-content-col col-md-9" aria-label="Danh sách bài viết">
              {result.data.length === 0 ? (
                <WpNoResults query={qParsed.value} />
              ) : (
                <>
                  <div className="bb-wp-news-list news-list">
                    <div className="bb-wp-row row">
                      {result.data.map((article) => (
                        <div key={article.id} className="bb-wp-card-col col-md-4 col-sm-6 col-12">
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
        </div>
      </div>
    </div>
  );
}

function WpCategoryWidget({ categories }: { categories: ContentCategoryWithCount[] }) {
  if (categories.length === 0) {
    return null;
  }

  return (
    <div className="bb-wp-widget widget">
      <div className="bb-wp-widget-title widget--title">
        <h3>Danh mục tin tức</h3>
      </div>
      <div className="bb-wp-widget-body widget--body">
        <div className="bb-wp-product-category product-category">
          <ul>
            {categories.map((cat) => {
              const href = cat.slug === ROOT_CATEGORY_SLUG
                ? toArticleListPath()
                : `${toArticleListPath()}${buildQueryString({ category: cat.slug })}`;

              return (
                <li key={cat.id}>
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
  const href = toArticlePath(article.slug);

  return (
    <article className="bb-wp-news-item news--item">
      <div className="news--item-thumbnail">
        <Link
          href={href}
          className="lazy"
          data-background-image={imageSrc ?? fallbackImageSrc ?? undefined}
        >
          <WpArticleImage src={imageSrc} fallbackSrc={fallbackImageSrc} alt={title} />
        </Link>
      </div>
      <div className="news--item-desc">
        {publishedAt ? (
          <div className="news-date">
            <p>{publishedAt}</p>
          </div>
        ) : null}
        <div className="news--item-inside">
          <p className="title-post">
            <Link href={href}>{title}</Link>
          </p>
          {excerpt ? <p>{excerpt}</p> : null}
        </div>
      </div>
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
    <nav className="bb-wp-pagination pagination pb-40 pt-20" aria-label="Phân trang bài viết">
      <ul className="text-right">
        <div className="paginate-links">
          <ul className="page-numbers">
            {page > 1 ? (
              <li {...{ index: 0 }}>
                <Link className="prev page-numbers" href={makeHref(page - 1)} aria-label="Trang trước">
                  <i className="fal fa-angle-left" aria-hidden="true" />
                </Link>
              </li>
            ) : null}
            {pages.map((item, itemIndex) => {
              const index = page > 1 ? itemIndex + 1 : itemIndex;

              return (
                <li key={`${item}-${itemIndex}`} {...{ index }}>
                  {item === "dots" ? (
                    <span className="page-numbers dots">…</span>
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
              );
            })}
            {page < totalPages ? (
              <li {...{ index: pages.length + (page > 1 ? 1 : 0) }}>
                <Link className="next page-numbers" href={makeHref(page + 1)} aria-label="Trang sau">
                  <i className="fal fa-angle-right" aria-hidden="true" />
                </Link>
              </li>
            ) : null}
          </ul>
        </div>
      </ul>
    </nav>
  );
}

function WpNoResults({ query }: { query?: string }) {
  return (
    <section className="no-results not-found">
      <header className="page-header">
        <h1 className="page-title">Nothing Found</h1>
      </header>
      <div className="page-content">
        <p>It seems we can’t find what you’re looking for. Perhaps searching can help.</p>
        <form role="search" method="get" className="search-form" action="/">
          <label>
            <span className="screen-reader-text">Search for:</span>
            <input
              className="form-control"
              type="text"
              placeholder="Tìm kiếm..."
              name="s"
              defaultValue={query ?? ""}
            />
          </label>
        </form>
      </div>
    </section>
  );
}

function buildWpPageItems(page: number, totalPages: number): Array<number | "dots"> {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (page === 1) {
    return [1, 2, "dots", totalPages];
  }

  if (page === 2) {
    return [1, 2, 3, "dots", totalPages];
  }

  if (page >= totalPages - 1) {
    return [1, "dots", totalPages - 2, totalPages - 1, totalPages].filter(
      (item, index, items): item is number | "dots" => item !== items[index - 1],
    );
  }

  return [1, "dots", page - 1, page, page + 1, "dots", totalPages];
}

function makeExcerpt(article: Article): string {
  const source = article.excerpt ?? article.body;
  const plain = stripHtml(source).replace(/\s+/g, " ").trim();

  if (!plain) {
    return "";
  }

  const words = plain.split(/\s+/);
  if (words.length <= WP_EXCERPT_WORDS) {
    return plain.replace(/\.\.\.$/, "…");
  }

  return `${words.slice(0, WP_EXCERPT_WORDS).join(" ")}…`;
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
