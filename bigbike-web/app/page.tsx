import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getLocale } from "next-intl/server";
import { BrandCarousel } from "@/components/home/BrandCarousel";
import { ExperienceCarousel } from "@/components/home/ExperienceCarousel";
import { FeaturedProductsCarousel } from "@/components/home/FeaturedProductsCarousel";
import { HeroSlider } from "@/components/home/HeroSlider";
import { HomeAnalytics } from "@/components/home/HomeAnalytics";
import { MobileCategoryGrid } from "@/components/home/MobileCategoryGrid";
import { MobileTrustSignals } from "@/components/home/MobileTrustSignals";
import { HomeVideoCarousel } from "@/components/home/HomeVideoCarousel";
import type {
  Article,
  Category,
  HomeHighlightItem,
  HomeSlider,
  HomeVideo,
  Product,
} from "@/lib/contracts/public";
import {
  getProductBySlug,
  listArticles,
  listBrands,
  listCategories,
  listHomeHighlights,
  listHomeSliders,
  listHomeVideos,
  listProducts,
  listPublicSettings,
} from "@/lib/api/public-api";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import {
  buildLocalBusinessJsonLd,
  buildOrganizationJsonLd,
  buildWebSiteJsonLd,
  serializeJsonLd,
} from "@/lib/seo/json-ld";
import {
  isSafeHomeVideoUrl,
  isSafePublicHref,
  resolveMediaUrl,
  safeText,
  toSafePublicHref,
} from "@/lib/utils/format";
import { sanitizeRichHtml } from "@/lib/utils/html";
import { pickSetting } from "@/lib/utils/settings";
import {
  toArticlePath,
  toCategoryPath,
  toHomePath,
  toProductListPath,
  toProductPath,
} from "@/lib/utils/routes";

export const dynamic = "force-dynamic";

const HOME_ORG_LOGO = "/wp/logo.png";
const DEFAULT_SITE_NAME = "BigBike";

function toLegacyWpMediaUrl(src: string | null | undefined): string | null {
  if (!src) return null;
  return src.startsWith("/wp-content/") ? `https://bigbike.vn${src}` : src;
}

export async function generateMetadata(): Promise<Metadata> {
  const settingsResult = await listPublicSettings();
  const settings = settingsResult.data ?? [];
  const siteName = pickSetting(settings, ["site_name"]) || DEFAULT_SITE_NAME;
  const title = pickSetting(settings, ["seo_home_title"]) || siteName;
  const description = pickSetting(settings, ["seo_home_description"]) || siteName;
  const ogImage = pickSetting(settings, ["og_image_url"]) || undefined;

  return {
    ...buildPublicMetadata({
      title,
      description,
      canonicalPath: toHomePath(),
      ogImage,
      siteName,
    }),
    title: { absolute: title },
  };
}

function sliderProductSlug(slider: HomeSlider): string | null {
  const link = slider.productLink?.trim() ?? "";
  const match = link.match(/\/sp\/(.+?)\.html$/) ?? link.match(/\/san-pham\/([^/?#]+)/);
  return match ? match[1] : null;
}

function toHeroSlide(slider: HomeSlider, product: Product | null) {
  const desktopSrc = toLegacyWpMediaUrl(resolveMediaUrl(slider.desktopImage?.url?.trim()));
  if (!desktopSrc) return null;

  const mobileSrc =
    toLegacyWpMediaUrl(resolveMediaUrl(slider.mobileImage?.url?.trim())) || desktopSrc;

  return {
    id: slider.id,
    desktopSrc,
    mobileSrc,
    href: toSafePublicHref(
      slider.link || slider.productLink || slider.externalLink,
      toProductListPath(),
    ),
    alt: safeText(slider.desktopImage?.alt || slider.mobileImage?.alt, DEFAULT_SITE_NAME),
    productName: product ? safeText(product.name, "") : "",
    categoryName: product?.category?.name ?? "",
    productCode: product?.sku?.trim() || DEFAULT_SITE_NAME,
  };
}

function isRenderableHomeVideo(video: HomeVideo): boolean {
  if (video.youtubeId && /^[A-Za-z0-9_-]{11}$/.test(video.youtubeId)) {
    return true;
  }

  return isSafeHomeVideoUrl(video.videoUrl);
}

function WpCategoryListItem({ category }: { category: Category }) {
  const name = safeText(category.name, "Danh mục");
  const imgAsset = category.image ?? category.icon;
  const src = resolveMediaUrl(imgAsset?.url?.trim()) || "/wp/category-fallback.png";

  return (
    <Link href={toCategoryPath(category.slug)} className="bb-cat-list-item">
      <span className="bb-cat-list-img" aria-hidden="true">
        <Image
          src={src}
          alt=""
          width={60}
          height={60}
          sizes="60px"
          className="bb-cat-list-icon"
        />
      </span>
      <span className="bb-cat-list-desc">{name}</span>
    </Link>
  );
}

function HomeCategoryHighlights({ items }: { items: HomeHighlightItem[] }) {
  if (items.length === 0) return null;

  return (
    <div className="category-list">
      <div className="container">
        <div className="row">
          {items.map((item) => {
            const href = toProductPath(item.productSlug);
            const categoryHref = toCategoryPath(item.categorySlug);
            const imageSrc = toLegacyWpMediaUrl(resolveMediaUrl(item.productImageUrl));

            return (
              <div key={item.slot} className="col-md-4">
                <div className="item">
                  <div className="item--thumbnail">
                    <Link href={href}>
                      {imageSrc ? (
                        <img
                          src={imageSrc}
                          alt={item.productName}
                          className="-swiper-lazy lazy"
                          loading="lazy"
                        />
                      ) : null}
                    </Link>
                  </div>
                  <Link className="item--category" href={categoryHref}>
                    {item.categoryName}
                  </Link>
                  <h3 className="item--title">
                    <Link href={href}>{item.productName}</Link>
                  </h3>
                  <Link className="item--btn" href={href}>
                    Mua ngay <i className="fal fa-chevron-right" aria-hidden="true" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PromoBanner({
  imageSrc,
  href,
  title,
  offLabel,
}: {
  imageSrc: string | null;
  href: string | null;
  title: string;
  offLabel: string;
}) {
  if (!imageSrc) return null;

  const alt = [title, offLabel].filter(Boolean).join(" - ") || "Khuyến mãi BigBike";
  const content = (
    <img
      src={imageSrc}
      alt={alt}
      className="lazy"
      loading="lazy"
      suppressHydrationWarning
    />
  );

  return (
    <div className="banner-ads pt-60">
      <div className="container">
        <div className="row">
          <div className="col-md-12">
            {href ? <Link href={href}>{content}</Link> : content}
          </div>
        </div>
      </div>
    </div>
  );
}

function stripHtmlToText(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateWpExcerpt(text: string, maxLength = 120): string {
  if (text.length <= maxLength) return text;

  const ending = "…";
  const cut = text.lastIndexOf(" ", maxLength - ending.length);
  const pos = cut > maxLength - 30 ? cut : maxLength - ending.length;
  return `${text.slice(0, pos).trimEnd()}${ending}`;
}

function resolveWpNewsExcerpt(article: Article): string {
  const manualExcerpt = article.excerpt?.trim();
  if (manualExcerpt) return truncateWpExcerpt(manualExcerpt);

  const bodyText = article.body ? stripHtmlToText(article.body) : "";
  return bodyText ? truncateWpExcerpt(bodyText) : "";
}

function formatWpHomeDate(value: string | null | undefined): string {
  const date = new Date(value ?? "");
  if (Number.isNaN(date.valueOf())) return "";

  return new Intl.DateTimeFormat("vi-VN", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).format(date);
}

function WpNewsCard({ article }: { article: Article }) {
  const title = safeText(article.title, "Bài viết");
  const excerpt = resolveWpNewsExcerpt(article);
  const src = toLegacyWpMediaUrl(resolveMediaUrl(article.coverImage?.url?.trim()));
  const href = toArticlePath(article.slug);
  const dateStr = formatWpHomeDate(article.publishedAt ?? article.createdAt);

  return (
    <div className="col-md-4 col-sm-6">
      <div className="news--item">
        <div className="news--item-thumbnail">
          <Link
            className="lazy"
            href={href}
            style={src ? { backgroundImage: `url("${src}")` } : undefined}
          >
            {src ? (
              <img
                src={src}
                alt={safeText(article.coverImage?.alt, title)}
                className="lazy"
                loading="lazy"
              />
            ) : null}
          </Link>
        </div>
        <div className="news--item-desc">
          <div className="news-date">
            <p>{dateStr}</p>
          </div>
          <div className="news--item-inside">
            <p className="title-post">
              <Link href={href}>{title}</Link>
            </p>
            {excerpt ? <p>{excerpt}</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function HomePage() {
  const locale = await getLocale();
  const [
    slidersResult,
    categoriesResult,
    expArticlesResult,
    newsArticlesResult,
    brandsResult,
    settingsResult,
    carouselProductsResult,
    homeVideosResult,
    homeHighlightsResult,
  ] = await Promise.all([
    listHomeSliders(),
    listCategories({
      page: 1,
      size: 100,
      sort: "sortOrder:asc",
      showOnHomepage: true,
      lang: locale,
    }),
    listArticles({
      page: 1,
      category: "reviews",
      size: 3,
      sort: "publishedAt:desc",
      lang: locale,
    }),
    listArticles({
      page: 1,
      category: "tin-tuc",
      size: 3,
      sort: "publishedAt:desc",
      lang: locale,
    }),
    listBrands({ page: 1, size: 12, sort: "name:asc", lang: locale }),
    listPublicSettings(),
    listProducts({
      page: 1,
      homepageBlock: "FEATURED_GRID",
      size: 12,
      sort: "homepageOrder:asc",
      lang: locale,
    }),
    listHomeVideos(),
    listHomeHighlights(),
  ]);

  const settings = settingsResult.data ?? [];
  const siteName = pickSetting(settings, ["site_name"]) || DEFAULT_SITE_NAME;
  const hotline = pickSetting(settings, ["hotline", "phone"]);
  const address = pickSetting(settings, ["contact_address", "address"]);
  const homeH1 = pickSetting(settings, ["seo_home_h1", "seo_home_title", "site_name"]) || siteName;
  const aboutTitle = pickSetting(settings, ["about_title"]);
  const aboutSubtitle = pickSetting(settings, ["about_subtitle", "site_name"]);
  const aboutHtml = pickSetting(settings, ["about_content_html"]);
  const homeContentBottomHtml = pickSetting(settings, ["home_content_bottom_html"]);
  const expSubtitle = pickSetting(settings, ["home_exp_subtitle"]);
  const expTitle = pickSetting(settings, ["home_exp_title"]);
  const expDesc = pickSetting(settings, ["home_exp_desc"]);
  const promoTitle = pickSetting(settings, ["promo_title"]);
  const promoOff = pickSetting(settings, ["promo_off"]);
  const promoHrefValue = pickSetting(settings, ["promo_href"]);
  const promoImageValue = pickSetting(settings, ["promo_image_url"]);

  const rawSliders = slidersResult.data ?? [];
  const sliderProducts = await Promise.all(
    rawSliders.map((slider) => {
      const slug = sliderProductSlug(slider);
      return slug ? getProductBySlug(slug, locale) : Promise.resolve(null);
    }),
  );

  const slides = rawSliders
    .map((slider, index) => toHeroSlide(slider, sliderProducts[index]?.data ?? null))
    .filter((slide): slide is NonNullable<typeof slide> => slide !== null);

  const expArticles = expArticlesResult.data;
  const newsArticles = newsArticlesResult.data;
  const carouselProducts = carouselProductsResult.data;
  const homeHighlights = homeHighlightsResult.data ?? [];
  const homeVideos = (homeVideosResult.data ?? []).filter(isRenderableHomeVideo).slice(0, 5);
  const aboutMarkup = aboutHtml
    ? sanitizeRichHtml(aboutHtml, { allowInlineStyles: true, rewriteMediaUrls: true })
    : "";
  const homeContentBottomMarkup = homeContentBottomHtml
    ? sanitizeRichHtml(homeContentBottomHtml, {
        allowInlineStyles: true,
        rewriteMediaUrls: true,
      })
    : "";
  const promoImageSrc = toLegacyWpMediaUrl(resolveMediaUrl(promoImageValue));
  const promoHref = isSafePublicHref(promoHrefValue) ? promoHrefValue.trim() : null;

  const jsonLdOrg = serializeJsonLd(buildOrganizationJsonLd(siteName, HOME_ORG_LOGO));
  const jsonLdWeb = serializeJsonLd(buildWebSiteJsonLd(siteName));
  const jsonLdLocalBusiness = serializeJsonLd(
    buildLocalBusinessJsonLd(siteName, HOME_ORG_LOGO, address, hotline),
  );

  return (
    <div className="bb-home">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdOrg }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdWeb }} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdLocalBusiness }}
      />

      <h1 className="sr-only">{homeH1}</h1>
      <HeroSlider slides={slides} />

      {categoriesResult.data.length > 0 && (
        <div className="block md:hidden">
          <MobileCategoryGrid categories={categoriesResult.data} />
        </div>
      )}

      <HomeCategoryHighlights items={homeHighlights} />

      {(aboutSubtitle || aboutTitle || aboutMarkup) && (
        <div className="about-bigbike">
          <div className="container">
            {(aboutSubtitle || aboutTitle) && (
              <div className="block-title text-center mb-40">
                {aboutSubtitle ? <p className="sub-title">{aboutSubtitle}</p> : null}
                {aboutTitle ? <h2>{aboutTitle}</h2> : null}
              </div>
            )}
            {aboutMarkup ? (
              <div
                className="block-content text-center"
                dangerouslySetInnerHTML={{ __html: aboutMarkup }}
              />
            ) : null}
          </div>
        </div>
      )}

      {carouselProducts.length > 0 && (
        <section
          className="bb-products-section bb-home-products-parity"
          aria-labelledby="home-products-heading"
        >
          <div className="bb-container">
            <div className="bb-products-header">
              <p className="bb-kicker">Sản phẩm nổi bật</p>
              <h2 id="home-products-heading" className="bb-products-title bb-section-title">
                Sản phẩm nổi bật tại BigBike
              </h2>
            </div>
            <FeaturedProductsCarousel products={carouselProducts} />
            {categoriesResult.data.length > 0 && (
              <div className="hidden md:block">
                <div className="bb-cat-list mb-[10px]" aria-label="Danh mục sản phẩm">
                  {categoriesResult.data.map((category) => (
                    <WpCategoryListItem key={category.id} category={category} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {carouselProducts.length === 0 && categoriesResult.data.length > 0 && (
        <div className="hidden md:block">
          <section className="bb-products-section" aria-label="Danh mục sản phẩm">
            <div className="bb-container">
              <div className="bb-cat-list">
                {categoriesResult.data.map((category) => (
                  <WpCategoryListItem key={category.id} category={category} />
                ))}
              </div>
            </div>
          </section>
        </div>
      )}

      <PromoBanner
        imageSrc={promoImageSrc}
        href={promoHref}
        title={promoTitle}
        offLabel={promoOff}
      />

      <div className="block md:hidden">
        <MobileTrustSignals />
      </div>

      {expArticles.length > 0 && (
        <section className="bb-experience bb-experience--home" aria-labelledby="home-exp-heading">
          {(expSubtitle || expTitle || expDesc) && (
            <div className="mx-auto w-full max-w-[1200px] px-[15px]">
              <div className="bb-experience-header text-center">
                {expSubtitle ? (
                  <p className="bb-experience-kicker">
                    {expSubtitle}
                  </p>
                ) : null}
                {expTitle ? (
                  <h2
                    id="home-exp-heading"
                    className="bb-experience-title"
                  >
                    {expTitle}
                  </h2>
                ) : null}
                {expDesc ? (
                  <div className="mx-auto w-full pt-[30px] md:w-2/3 min-[1200px]:max-w-[770px]">
                    <p className="bb-experience-desc">
                      {expDesc}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          )}
          <ExperienceCarousel articles={expArticles} />
        </section>
      )}

      {newsArticles.length > 0 && (
        <div className="news pt-60 bb-home-news-parity">
          <div className="container">
            <div className="block-title text-center pb-40">
              <p className="sub-title">Tin tức & cập nhật</p>
              <h2>Cập nhật xu hướng cùng BigBike</h2>
            </div>
            <div className="news-list">
              <div className="row">
                {newsArticles.map((article) => (
                  <WpNewsCard key={article.id} article={article} />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {homeVideos.length > 0 && (
        <section className="videos-slide relative bg-background pt-[80px]" aria-labelledby="home-video-heading">
          <div className="videos-slide--inner relative bg-[url('/wp/video-bg.jpg')] bg-cover bg-center bg-no-repeat pb-[90px]">
            <div className="relative z-[1] mx-auto w-full max-w-[1200px] px-[15px]">
              <div className="pb-[70px] pt-[90px] text-center text-white max-[767px]:pb-10 max-[767px]:pt-12">
                <h2
                  id="home-video-heading"
                  className="bb-home-video-title"
                >
                  Trải nghiệm sản phẩm cùng BigBike.vn
                </h2>
              </div>
              <HomeVideoCarousel videos={homeVideos} />
            </div>
          </div>
        </section>
      )}

      {brandsResult.data.length > 0 && (
        <div className="partner-slide pt-120 pb-120">
          <BrandCarousel brands={brandsResult.data} />
        </div>
      )}

      {homeContentBottomMarkup ? (
        <div className="content-bottom wyswyg">
          <div
            className="container"
            dangerouslySetInnerHTML={{ __html: homeContentBottomMarkup }}
          />
        </div>
      ) : null}

      <HomeAnalytics />
    </div>
  );
}
