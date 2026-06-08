import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
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
import { sectionHeading } from "@/lib/ui-classes";
import { PaginationNav } from "@/components/ui/PaginationNav";
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
        <div id="main-content" className="pb-0">
          <Container variant="blog" className="container">
            <WpNoResults query={qParsed.value} />
          </Container>
        </div>
      </div>
    );
  }

  const locale = await getLocale();
  const [result, categoriesResult, settingsResult] = await Promise.all([
    listArticles({
      page: pageParsed.value,
      size: sizeParsed.value,
      sort: "publishedAt:desc",
      category: categoryParsed.value,
      q: qParsed.value,
      lang: locale,
    }),
    listContentCategories(),
    listPublicSettings(locale),
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

      <div id="main-content" className="pb-0">
        <Container variant="blog" className="container">
          <div className="flex flex-wrap -mx-[15px]">
            <aside
              className="relative w-full px-[15px] flex-[0_0_25%] max-w-[25%] max-md:hidden max-md:flex-[0_0_100%] max-md:max-w-full max-md:mb-0"
              aria-label="Danh mục tin tức"
            >
              <WpCategoryWidget categories={sidebarCategories} />
            </aside>

            <section
              className="relative w-full px-[15px] flex-[0_0_75%] max-w-[75%] max-md:flex-[0_0_100%] max-md:max-w-full"
              aria-label="Danh sách bài viết"
            >
              {result.data.length === 0 ? (
                <WpNoResults query={qParsed.value} />
              ) : (
                <>
                  <div className="news-list">
                    <div className="flex flex-wrap -mx-[15px]">
                      {result.data.map((article) => (
                        <div
                          key={article.id}
                          className="relative w-full px-[15px] mb-[30px] flex flex-col flex-[0_0_100%] max-w-full min-[576px]:flex-[0_0_50%] min-[576px]:max-w-[50%] md:flex-[0_0_33.333333%] md:max-w-[33.333333%]"
                        >
                          <WpArticleCard article={article} />
                        </div>
                      ))}
                    </div>
                  </div>

                  {result.pagination ? (
                    <PaginationNav
                      page={result.pagination.page}
                      totalPages={result.pagination.totalPages}
                      baseHref={makeListHref({
                        size: sizeParsed.value,
                        category: categoryParsed.value,
                      })}
                      variant="archive"
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
    <div className="pb-[15px] mb-[30px] border-b border-b-border-default">
      <div className="pb-[15px]">
        <h3 className={sectionHeading}>
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
                    <span className="absolute top-0 right-[3px] w-5 h-5 text-white font-semibold text-center after:content-[''] after:absolute after:inset-0 after:z-0 after:block after:bg-border-default after:[transform:rotate(45deg)]">
                      <span className="relative z-[1] block text-ui-14 leading-5">{cat.articleCount}</span>
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
  const imageUrl = article.coverImage?.url;
  const imageSrc = resolveWpUploadUrl(imageUrl);
  const fallbackImageSrc = makeSlugThumbnailFallback(imageUrl, article.slug);
  const href = toArticlePath(article.slug);

  return (
    <article className="flex flex-col flex-1 mb-0 bg-card [box-shadow:var(--bb-shadow-md)]">
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
            <p className="inline-block m-0 text-foreground font-body text-ui-12 font-normal leading-5 before:content-['/'] before:mr-2.5 before:inline-block">
              {publishedAt}
            </p>
          </div>
        ) : null}
        <div className="px-5 pb-[30px] max-md:bg-card">
          <p className="m-0 mb-[25px] font-body text-body font-semibold leading-5 text-foreground">
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

