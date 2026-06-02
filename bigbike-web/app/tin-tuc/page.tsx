import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Container } from "@/components/layout/Container";
import { PageHero } from "@/components/layout/PageHero";
import { listArticles, listContentCategories, listPublicSettings } from "@/lib/api/public-api";
import type { Article, ContentCategoryWithCount } from "@/lib/contracts/public";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { readDefaultHeroAssets, readHeroSettings } from "@/lib/utils/page-hero";
import {
  buildQueryString,
  collectErrors,
  parsePositiveIntParam,
  parseSlugParam,
  parseTextParam,
  readSingleSearchParam,
} from "@/lib/utils/query";
import { toArticleListPath, toArticlePath, toHomePath } from "@/lib/utils/routes";
import { safeText } from "@/lib/utils/format";
import { stripHtmlTags } from "@/lib/utils/text";
import { makeSlugThumbnailFallback, resolveWpUploadUrl } from "@/lib/utils/wp-media";
import { WpArticleImage } from "./WpArticleImage";

type ArticleListPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const DEFAULT_PAGE_SIZE = 12;
const ROOT_CATEGORY_SLUG = "tin-tuc";
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
          <Container variant="blog" className="container">
            <WpNoResults query={qParsed.value} />
          </Container>
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
  const defaultHero = readDefaultHeroAssets(settingsResult.data ?? []);
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
        mobileImageUrl={heroSettings.mobileImageUrl}
        imageAlt={heroSettings.imageAlt}
        defaultBgUrl={defaultHero.defaultBgUrl}
        defaultIllustrationUrl={defaultHero.defaultIllustrationUrl}
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
        <Container variant="blog" className="container">
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
        </Container>
      </div>
    </div>
  );
}

function WpCategoryWidget({ categories }: { categories: ContentCategoryWithCount[] }) {
  if (categories.length === 0) {
    return null;
  }

  return (
    <div className="pb-[15px] mb-[30px] border-b border-b-[#cecece]">
      <div className="pb-[15px]">
        <h3 className="m-0 text-foreground font-heading text-2xl font-semibold leading-[1.3] tracking-normal normal-case">
          Danh mục tin tức
        </h3>
      </div>
      <div>
        <div>
          <ul className="m-0 p-0 list-none">
            {categories.map((cat) => {
              const href = cat.slug === ROOT_CATEGORY_SLUG
                ? toArticleListPath()
                : `${toArticleListPath()}${buildQueryString({ category: cat.slug })}`;

              return (
                <li key={cat.id} className="relative m-0 py-[15px]">
                  <Link
                    href={href}
                    className="relative block min-h-5 pr-7 text-muted-foreground font-body text-[length:var(--fs-body)] font-normal leading-5 no-underline [transition:none] hover:text-brand"
                  >
                    {cat.name}
                    <span className="absolute top-0 right-[3px] w-5 h-5 text-white font-semibold text-center after:content-[''] after:absolute after:inset-0 after:z-0 after:block after:bg-[#cecece] after:[transform:rotate(45deg)]">
                      <span className="relative z-[1] block text-[14px] leading-5">{cat.articleCount}</span>
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
  const title = safeText(article.title, "Bài viết");
  const excerpt = makeExcerpt(article);
  const publishedAt = formatWpDate(article.publishedAt ?? article.createdAt);
  const imageUrl = (article.coverImage ?? article.productImage)?.url;
  const imageSrc = resolveWpUploadUrl(imageUrl);
  const fallbackImageSrc = makeSlugThumbnailFallback(imageUrl, article.slug);
  const href = toArticlePath(article.slug);

  return (
    <article className="flex flex-col flex-1 mb-0 bg-card [box-shadow:var(--bb-shadow-md)] max-md:border max-md:border-solid max-md:border-border max-md:[box-shadow:none]">
      <div className="news--item-thumbnail">
        <Link
          href={href}
          className="lazy"
          data-background-image={imageSrc ?? fallbackImageSrc ?? undefined}
        >
          <WpArticleImage src={imageSrc} fallbackSrc={fallbackImageSrc} alt={title} />
        </Link>
      </div>
      <div className="relative max-md:bg-card">
        {publishedAt ? (
          <div className="pt-5 px-5 pb-2.5">
            <p className="inline-block m-0 text-foreground font-body text-[length:var(--fs-body)] font-normal leading-5 before:content-['/'] before:mr-2.5 before:inline-block">
              {publishedAt}
            </p>
          </div>
        ) : null}
        <div className="px-5 pb-[30px] max-md:bg-card">
          <p className="m-0 mb-[25px] font-heading text-xl font-semibold leading-6 text-foreground">
            <Link href={href} className="text-black no-underline [transition:none]">
              {title}
            </Link>
          </p>
          {excerpt ? (
            <p className="m-0 text-foreground font-body text-base font-normal leading-5">{excerpt}</p>
          ) : null}
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
  const plain = stripHtmlTags(source).replace(/\s+/g, " ").trim();

  if (!plain) {
    return "";
  }

  const words = plain.split(/\s+/);
  if (words.length <= WP_EXCERPT_WORDS) {
    return plain.replace(/\.\.\.$/, "…");
  }

  return `${words.slice(0, WP_EXCERPT_WORDS).join(" ")}…`;
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

