"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { WpCategoryPagination } from "@/components/wp/WpCategoryPagination";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchPublicArticleList } from "@/lib/api/client-api";
import type { Article, ContentCategoryWithCount } from "@/lib/contracts/public";
import { safeText } from "@/lib/utils/format";
import { stripHtmlTags } from "@/lib/utils/text";
import { buildQueryString } from "@/lib/utils/query";
import { toArticleListPath, toArticlePath } from "@/lib/utils/routes";
import { makeSlugThumbnailFallback, resolveWpUploadUrl } from "@/lib/utils/wp-media";
import { WpArticleImage } from "./WpArticleImage";

const DEFAULT_PAGE_SIZE = 12;
const ROOT_CATEGORY_SLUG = "tin-tuc";
const WP_EXCERPT_CHARS = 120;

/**
 * Lưới tin tức CSR — trang /tin-tuc render shell tĩnh (ISR: hero + danh mục), còn
 * danh sách bài (lọc danh mục / tìm / phân trang theo searchParams) fetch ở CLIENT.
 * Sidebar + intro + grid + pagination đều ở đây để phản ánh searchParams mà không SSR.
 */
export function WpArticleListClient({
  categories,
  contentTop,
  contentBottom,
}: {
  categories: ContentCategoryWithCount[];
  contentTop: string;
  contentBottom: string;
}) {
  const searchParams = useSearchParams();
  const locale = useLocale();

  const { page, size, category, q } = useMemo(() => {
    const rawCategory = searchParams.get("category") ?? undefined;
    const pageNum = Number(searchParams.get("paged") ?? searchParams.get("page") ?? "1");
    const sizeNum = Number(searchParams.get("size") ?? `${DEFAULT_PAGE_SIZE}`);
    return {
      page: Number.isFinite(pageNum) && pageNum >= 1 ? Math.floor(pageNum) : 1,
      size: Number.isFinite(sizeNum) && sizeNum >= 1 ? Math.floor(sizeNum) : DEFAULT_PAGE_SIZE,
      category: rawCategory === "all" ? undefined : rawCategory?.trim() || undefined,
      q: searchParams.get("q")?.trim() || undefined,
    };
  }, [searchParams]);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["public-articles", { page, size, category, q, lang: locale }],
    queryFn: () => fetchPublicArticleList({ page, size, category, q, lang: locale }),
    staleTime: 60 * 1000,
    placeholderData: (prev) => prev,
  });

  const articles = data?.data ?? [];
  const pagination = data?.pagination ?? null;
  const showCategoryIntro = !category && !q;
  const firstLoading = isLoading && articles.length === 0;

  const makeListHref = (overrides: { category?: string; size?: number }) => {
    const nextSize = overrides.size && overrides.size !== DEFAULT_PAGE_SIZE ? overrides.size : undefined;
    return `${toArticleListPath()}${buildQueryString({ size: nextSize, category: overrides.category, q })}`;
  };

  const emptyNotice = isError
    ? (error instanceof Error ? error.message : "Không tải được danh sách bài viết.")
    : isLoading
      ? "Đang tải bài viết…"
      : "Chưa có bài viết nào.";

  return (
    <>
      {showCategoryIntro ? (
        <div className="block-text pb-60">
          <div>
            <p style={{ textAlign: "justify" }}>{contentTop}</p>
          </div>
          <div>&nbsp;</div>
        </div>
      ) : null}

      <div className="row">
        <div className="col-md-3">
          <WpNewsCategoryWidget categories={categories} activeSlug={category} />
        </div>

        <div className="col-md-9 bb-blog-listing-parity">
          {firstLoading ? (
            <div className="news-list">
              <div className="row">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div className="col-md-4 col-sm-6 col-12" key={i}>
                    <div className="news--item">
                      <Skeleton className="aspect-[4/3] w-full rounded-none" />
                      <div className="news--item-desc">
                        <Skeleton className="mt-3 h-3 w-20" />
                        <Skeleton className="mt-2 h-4 w-11/12" />
                        <Skeleton className="mt-2 h-4 w-3/5" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : articles.length === 0 ? (
            <p className="woocommerce-info">{emptyNotice}</p>
          ) : (
            <>
              <div className="news-list">
                <div className="row">
                  {articles.map((article) => (
                    <div className="col-md-4 col-sm-6 col-12" key={article.id}>
                      <WpBlogGridItem article={article} />
                    </div>
                  ))}
                </div>
              </div>

              {pagination ? (
                <WpCategoryPagination
                  page={pagination.page}
                  totalPages={pagination.totalPages}
                  baseHref={makeListHref({ size, category })}
                />
              ) : null}
            </>
          )}
        </div>
      </div>

      {showCategoryIntro ? (
        <div className="block-text pt-100 pb-60">
          <p>&nbsp;</p>
          <p style={{ textAlign: "justify" }}>{contentBottom}</p>
        </div>
      ) : null}
    </>
  );
}

/** Sidebar widget — port 1:1 từ category.php: danh mục tin tức + badge số bài. */
function WpNewsCategoryWidget({
  categories,
  activeSlug,
}: {
  categories: ContentCategoryWithCount[];
  activeSlug?: string;
}) {
  const t = useTranslations("Blog");
  if (categories.length === 0) {
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
                ? toArticleListPath()
                : `${toArticleListPath()}${buildQueryString({ category: cat.slug })}`;
              const isActive = isRoot ? !activeSlug : cat.slug === activeSlug;

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

/** content-blog-grid-item.php — thẻ bài viết trong lưới tin tức. */
function WpBlogGridItem({ article }: { article: Article }) {
  const title = safeText(article.title, "Bài viết");
  const excerpt = makeExcerpt(article);
  const publishedAt = formatWpDate(article.publishedAt ?? article.createdAt);
  const imageUrl = article.coverImage?.url;
  const imageSrc = resolveWpUploadUrl(imageUrl);
  const fallbackImageSrc = makeSlugThumbnailFallback(imageUrl, article.slug);
  const href = toArticlePath(article.slug);

  return (
    <div className="news--item">
      <div className="news--item-thumbnail">
        <Link href={href} className="lazy">
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
  return `${plain.slice(0, WP_EXCERPT_CHARS).trimEnd()}…`;
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
