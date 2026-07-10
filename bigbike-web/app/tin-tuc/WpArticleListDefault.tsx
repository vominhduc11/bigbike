import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { WpCategoryPagination } from "@/components/wp/WpCategoryPagination";
import type { Article, ContentCategoryWithCount } from "@/lib/contracts/public";
import { safeText } from "@/lib/utils/format";
import { buildQueryString } from "@/lib/utils/query";
import { toArticleListPath, toArticlePath } from "@/lib/utils/routes";
import { stripHtmlTags } from "@/lib/utils/text";
import { makeSlugThumbnailFallback, resolveWpUploadUrl } from "@/lib/utils/wp-media";
import { resolveLocale, type Locale } from "@/i18n/locale";

const ROOT_CATEGORY_SLUG = "tin-tuc";
const WP_EXCERPT_CHARS = 120;

type ArticlePagination = {
  page: number;
  totalPages: number;
  totalItems?: number | null;
};

export async function WpArticleListDefault({
  categories,
  articles,
  pagination,
  locale,
}: {
  categories: ContentCategoryWithCount[];
  articles: Article[];
  pagination?: ArticlePagination | null;
  locale: string;
}) {
  const t = await getTranslations("Blog");
  const resolvedLocale = resolveLocale(locale);
  const hasMultipleCategories = categories.length > 1;

  return (
    <>
      <div className="block-text pb-60">
        <div>
          <p style={{ textAlign: "justify" }}>{t("contentTop")}</p>
        </div>
        <div>&nbsp;</div>
      </div>

      <div className="row">
        {hasMultipleCategories ? (
          <div className="col-md-3">
            <WpNewsCategoryWidgetDefault categories={categories} locale={resolvedLocale} />
          </div>
        ) : null}

        <div className={hasMultipleCategories ? "col-md-9 bb-blog-listing-parity" : "col-md-12 bb-blog-listing-parity"}>
          {articles.length === 0 ? (
            <p className="woocommerce-info">{t("listEmpty")}</p>
          ) : (
            <>
              <div className="relative">
                <div className="news-list">
                  <div className="row">
                    {articles.map((article) => (
                      <div className="col-md-4 col-sm-6 col-12" key={article.id}>
                        <WpBlogGridItemDefault article={article} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {pagination ? (
                <WpCategoryPagination
                  page={pagination.page}
                  totalPages={pagination.totalPages}
                  baseHref={toArticleListPath(resolvedLocale)}
                />
              ) : null}
            </>
          )}
        </div>
      </div>

      <div className="block-text pt-100 pb-60">
        <p>&nbsp;</p>
        <p style={{ textAlign: "justify" }}>{t("contentBottom")}</p>
      </div>
    </>
  );
}

async function WpNewsCategoryWidgetDefault({
  categories,
  locale,
}: {
  categories: ContentCategoryWithCount[];
  locale: Locale;
}) {
  const t = await getTranslations("Blog");
  if (categories.length <= 1) {
    return null;
  }

  return (
    <div className="widget">
      <div className="widget--title">
        <h3>{t("categoriesHeading")}</h3>
      </div>
      <div className="widget--body">
        <div className="product-category">
          <ul>
            {categories.map((cat) => {
              const isRoot = cat.slug === ROOT_CATEGORY_SLUG;
              const href = isRoot
                ? toArticleListPath(locale)
                : `${toArticleListPath(locale)}${buildQueryString({ category: cat.slug })}`;
              const isActive = isRoot;

              return (
                <li key={cat.id} className={isActive ? "current" : undefined}>
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

function WpBlogGridItemDefault({ article }: { article: Article }) {
  const title = safeText(article.title, "Bai viet");
  const excerpt = makeExcerpt(article);
  const publishedAt = article.publishedAt ?? article.createdAt;
  const imageUrl = article.coverImage?.url;
  const imageSrc = resolveWpUploadUrl(imageUrl);
  const fallbackImageSrc = makeSlugThumbnailFallback(imageUrl, article.slug);

  return (
    <div className="news--item">
      <div className="news--item-thumbnail">
        <Link href={toArticlePath(article.slug)} className="lazy">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageSrc ?? fallbackImageSrc ?? transparentThumbnail()}
            data-src={imageSrc ?? undefined}
            data-fallback-src={fallbackImageSrc ?? undefined}
            alt={title}
            className={imageSrc ? "lazy" : "lazy bb-news-img-placeholder"}
            loading="lazy"
            decoding="async"
          />
        </Link>
      </div>
      <div className="news--item-desc">
        {publishedAt ? (
          <div className="news-date">
            <p>{formatSlashDate(publishedAt)}</p>
          </div>
        ) : null}
        <div className="news--item-inside">
          <p className="title-post">
            <Link href={toArticlePath(article.slug)}>{title}</Link>
          </p>
          {excerpt ? <p>{excerpt}</p> : null}
        </div>
      </div>
    </div>
  );
}

function makeExcerpt(article: Article): string {
  const source = article.excerpt || article.body;
  const plain = stripHtmlTags(source).replace(/\s+/g, " ").trim();
  if (!plain) {
    return "";
  }
  if (plain.length <= WP_EXCERPT_CHARS) {
    return plain;
  }
  return `${plain.slice(0, WP_EXCERPT_CHARS).trimEnd()}...`;
}

function formatSlashDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return "";
  }
  const parts = new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")}`;
}

function transparentThumbnail(): string {
  return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='169' viewBox='0 0 300 169'%3E%3C/svg%3E";
}
