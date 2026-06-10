import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { WpCategoryHero, type WpCategoryCrumb } from "@/components/wp/WpCategoryHero";
import { WpCategoryPagination } from "@/components/wp/WpCategoryPagination";
import {
  listArticles,
  listContentCategories,
  listPublicSettings,
} from "@/lib/api/public-api";
import type { Article, ContentCategoryWithCount } from "@/lib/contracts/public";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { resolveMediaUrl, safeText, toLegacyWpMediaUrl } from "@/lib/utils/format";
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
import { stripHtmlTags } from "@/lib/utils/text";
import { makeSlugThumbnailFallback, resolveWpUploadUrl } from "@/lib/utils/wp-media";
import { WpArticleImage } from "./WpArticleImage";

type ArticleListPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const DEFAULT_PAGE_SIZE = 12;
const ROOT_CATEGORY_SLUG = "tin-tuc";
const WP_EXCERPT_CHARS = 120;

// content_top / content_bottom — ACF của category "Tin tức" trên WP (backend
// content-categories không lưu field này nên giữ tĩnh, port 1:1 từ bigbike.vn).
// Chỉ hiển thị ở view gốc /tin-tuc (không lọc danh mục, không tìm kiếm).
const NEWS_CONTENT_TOP =
  "Bên cạnh việc mang đến khách hàng các sản phẩm phượt moto cao cấp chính hãng, " +
  "Bigbike mong muốn chia sẻ các thông tin chi tiết cũng như các bí quyết lựa chọn " +
  "quần áo bảo hộ, mũ bảo hiểm, găng tay, giày bảo hộ và các phụ kiện phượt moto khác " +
  "trên trang TIN TỨC của chúng tôi. Ngoài ra, các bài đánh giá và xếp hạng sản phẩm " +
  "bảo hộ phượt moto uy tín, chất lượng và các xu hướng mới nhất trên thị trường cũng " +
  "luôn được cập nhật thường xuyên.";
const NEWS_CONTENT_BOTTOM =
  "Qua những thông tin và các bài viết được chia sẻ, Bigbike hy vọng các anh em biker " +
  "sẽ cập nhật thêm nhiều thông tin bổ ích và có thể chọn lựa sản phẩm bảo hộ phượt moto " +
  "phù hợp cho mình. Tuy nhiên, các sản phẩm bảo hộ phượt moto là những mặt hàng đòi hỏi " +
  "người mua phải cân nhắc trên nhiều khía cạnh như kích cỡ, chất liệu và thiết kế. " +
  "Chính vì thế, Bigbike khuyên rằng khách hàng nên đến trực tiếp cửa hàng để được tư vấn, " +
  "hỗ trợ thêm về thông tin các sản phẩm và các dịch vụ tại Bigbike. " +
  "Xin chân thành cảm ơn sự tín nhiệm của khách hàng dành cho Bigbike!";

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

  const locale = await getLocale();
  const settingsResult = await listPublicSettings(locale);

  const heroSettings = readHeroSettings(settingsResult.data ?? [], "hero_news");
  const defaultHero = readDefaultHeroAssets(settingsResult.data ?? []);
  const heroBgUrl = toLegacyWpMediaUrl(
    resolveMediaUrl(heroSettings.imageUrl?.trim()) || defaultHero.defaultBgUrl?.trim(),
  );
  const heroIllustrationUrl = toLegacyWpMediaUrl(
    resolveMediaUrl(defaultHero.defaultIllustrationUrl?.trim()),
  );

  const stylesheet = (
    <link
      rel="stylesheet"
      href="/wp-content/themes/bigbike/css/wp-theme-news.css?v=4"
      precedence="default"
    />
  );

  if (validationErrors.length > 0) {
    const errorTitle = heroSettings.title ?? "Tin tức";
    return (
      <>
        {stylesheet}
        <div className="archive category">
          <WpCategoryHero
            title={errorTitle}
            breadcrumb={[
              { label: "Bigbike.vn", href: toHomePath() },
              { label: t("breadcrumb") },
            ]}
            bgUrl={heroBgUrl}
            illustrationUrl={heroIllustrationUrl}
            illustrationAlt={heroSettings.imageAlt ?? errorTitle}
          />
          <div id="main-content">
            <div className="container">
              <p className="woocommerce-info">{validationErrors.join(" ")}</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  const [result, categoriesResult] = await Promise.all([
    listArticles({
      page: pageParsed.value,
      size: sizeParsed.value,
      sort: "publishedAt:desc",
      category: categoryParsed.value,
      q: qParsed.value,
      lang: locale,
    }),
    listContentCategories(),
  ]);

  const sidebarCategories = categoriesResult.data.filter((cat) => cat.articleCount > 0);
  const activeCategory = sidebarCategories.find((cat) => cat.slug === categoryParsed.value);
  const heroTitle = activeCategory?.name ?? heroSettings.title ?? "Tin tức";
  // content_top/bottom chỉ thuộc category gốc "Tin tức" — ẩn khi lọc danh mục/tìm kiếm.
  const showCategoryIntro = !categoryParsed.value && !qParsed.value;

  const heroBreadcrumb: WpCategoryCrumb[] = activeCategory
    ? [
        { label: "Bigbike.vn", href: toHomePath() },
        { label: t("breadcrumb"), href: toArticleListPath() },
        { label: activeCategory.name },
      ]
    : [
        { label: "Bigbike.vn", href: toHomePath() },
        { label: t("breadcrumb") },
      ];

  const makeListHref = (overrides: { category?: string; size?: number }) => {
    const nextSize =
      overrides.size && overrides.size !== DEFAULT_PAGE_SIZE ? overrides.size : undefined;
    return `${toArticleListPath()}${buildQueryString({
      size: nextSize,
      category: overrides.category,
      q: qParsed.value,
    })}`;
  };

  return (
    <>
      {stylesheet}

      <div className="archive category">
        <WpCategoryHero
          title={heroTitle}
          breadcrumb={heroBreadcrumb}
          bgUrl={heroBgUrl}
          illustrationUrl={heroIllustrationUrl}
          illustrationAlt={heroSettings.imageAlt ?? heroTitle}
        />

        <div id="main-content">
          <div className="container">
            {showCategoryIntro ? (
              <div className="block-text pb-60">
                <div>
                  <p style={{ textAlign: "justify" }}>{NEWS_CONTENT_TOP}</p>
                </div>
                <div>&nbsp;</div>
              </div>
            ) : null}

            <div className="row">
              <div className="col-md-3">
                <WpNewsCategoryWidget
                  categories={sidebarCategories}
                  activeSlug={categoryParsed.value}
                />
              </div>

              <div className="col-md-9 bb-blog-listing-parity">
                {result.data.length === 0 ? (
                  <p className="woocommerce-info">
                    {result.error?.message ?? "Chưa có bài viết nào."}
                  </p>
                ) : (
                  <>
                    <div className="news-list">
                      <div className="row">
                        {result.data.map((article) => (
                          <div className="col-md-4 col-sm-6 col-12" key={article.id}>
                            <WpBlogGridItem article={article} />
                          </div>
                        ))}
                      </div>
                    </div>

                    {result.pagination ? (
                      <WpCategoryPagination
                        page={result.pagination.page}
                        totalPages={result.pagination.totalPages}
                        baseHref={makeListHref({
                          size: sizeParsed.value,
                          category: categoryParsed.value,
                        })}
                      />
                    ) : null}
                  </>
                )}
              </div>
            </div>

            {showCategoryIntro ? (
              <div className="block-text pt-100 pb-60">
                <p>&nbsp;</p>
                <p style={{ textAlign: "justify" }}>{NEWS_CONTENT_BOTTOM}</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * Sidebar widget — port 1:1 từ category.php: danh sách danh mục tin tức
 * với badge số bài (.product-category .count).
 */
function WpNewsCategoryWidget({
  categories,
  activeSlug,
}: {
  categories: ContentCategoryWithCount[];
  activeSlug?: string;
}) {
  if (categories.length === 0) {
    return null;
  }

  return (
    <div className="widget">
      <div className="widget--title">
        <h3>Danh mục tin tức</h3>
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

/**
 * content-blog-grid-item.php — thẻ bài viết trong lưới tin tức.
 */
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
  // excerpt có thể là chuỗi rỗng "" (API trả "") → dùng || để fallback sang body.
  // Không dùng ?? vì ?? chỉ fallback null/undefined, "" sẽ lọt qua làm mất mô tả.
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
