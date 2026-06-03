import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getLocale } from "next-intl/server";
import { Container } from "@/components/layout/Container";
import { cn } from "@/lib/utils";
import { BrandCarousel } from "@/components/home/BrandCarousel";
import { ExperienceCarousel } from "@/components/home/ExperienceCarousel";
import { FeaturedProductsCarousel } from "@/components/home/FeaturedProductsCarousel";
import { HeroSlider } from "@/components/home/HeroSlider";
import { HomeAnalytics } from "@/components/home/HomeAnalytics";
import { MobileCategoryGrid } from "@/components/home/MobileCategoryGrid";
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
  toLegacyWpMediaUrl,
  toSafePublicHref,
} from "@/lib/utils/format";
import { sanitizeRichHtml } from "@/lib/utils/html";
import { stripHtmlToText } from "@/lib/utils/text";
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
    <Link
      href={toCategoryPath(category.slug)}
      className="group relative flex flex-col items-center justify-center h-[290px] p-[30px] bg-white border-r border-b border-r-[#cecece] border-b-[#cecece] text-center no-underline cursor-pointer overflow-hidden before:content-[''] before:absolute before:inset-0 before:bg-[url('/wp/cat-hover.jpg')] before:bg-[position:top_center] before:bg-cover before:bg-no-repeat before:opacity-0 before:[transition:opacity_0.2s_ease] hover:before:opacity-100 focus-visible:[outline:var(--bb-focus-outline)] focus-visible:[outline-offset:-3px] focus-visible:z-[2]"
    >
      <span
        className="relative z-[1] flex items-center justify-center w-[72px] h-[72px] min-[1536px]:w-20 min-[1536px]:h-20 min-[2560px]:w-[88px] min-[2560px]:h-[88px] pointer-events-none"
        aria-hidden="true"
      >
        <Image
          src={src}
          alt=""
          width={96}
          height={96}
          sizes="(min-width: 2560px) 88px, (min-width: 1536px) 80px, 72px"
          className="block w-full h-full object-contain [transition:filter_0.2s_ease,transform_0.2s_ease] group-hover:[filter:brightness(0)_invert(1)] group-hover:[transform:scale(1.06)] group-active:[transform:scale(0.97)]"
        />
      </span>
      <span className="relative z-[1] line-clamp-2 mt-6 font-[family-name:var(--bb-font-cta)] font-semibold text-[17px] min-[1536px]:text-[18px] min-[2560px]:text-[20px] leading-[1.2] tracking-[0.02em] uppercase text-foreground [transition:color_0.2s_ease] group-hover:text-white">
        {name}
      </span>
    </Link>
  );
}

function HomeCategoryHighlights({ items }: { items: HomeHighlightItem[] }) {
  if (items.length === 0) return null;

  return (
    <div className="category-list py-15 max-[1024px]:py-13 max-md:py-10">
      <div className="container">
        <div className="row">
          {items.map((item, idx) => {
            const href = toProductPath(item.productSlug);
            const categoryHref = toCategoryPath(item.categorySlug);
            const imageSrc = toLegacyWpMediaUrl(resolveMediaUrl(item.productImageUrl));

            return (
              <div key={item.slot} className="col-md-4">
                <div
                  className={cn(
                    "relative h-[300px] min-[1920px]:h-[360px] min-[2560px]:h-[480px] max-md:h-[180px] p-[30px] min-[2560px]:p-10 max-md:p-[18px_20px] border border-[#cecece] bg-white uppercase",
                    idx < items.length - 1 && "max-md:mb-5",
                  )}
                >
                  <div className="absolute right-[30px] min-[2560px]:right-10 max-md:right-[18px] bottom-0">
                    <Link href={href}>
                      {imageSrc ? (
                        <img
                          src={imageSrc}
                          alt={item.productName}
                          className="w-auto max-h-[180px] min-[1920px]:max-h-[220px] min-[2560px]:max-h-[310px] max-md:max-h-[130px]"
                          loading="lazy"
                        />
                      ) : null}
                    </Link>
                  </div>
                  <Link className="hidden" href={categoryHref}>
                    {item.categoryName}
                  </Link>
                  <h3 className="mb-[40px] min-[2560px]:mb-[50px] max-md:mb-[16px] max-w-[55%] max-md:max-w-[56%] font-[family-name:var(--bb-font-display)] text-[clamp(1.125rem,0.645rem_+_1vw,2.25rem)] max-md:text-[0.875rem] font-semibold leading-[1.2] max-md:leading-[1.25] line-clamp-2">
                    <Link href={href} className="!text-black">
                      {item.productName}
                    </Link>
                  </h3>
                  <Link
                    href={href}
                    className="!text-brand font-[family-name:var(--bb-font-display)] text-[clamp(0.875rem,0.5rem_+_0.5vw,1.375rem)] max-md:text-[0.8125rem] font-semibold normal-case"
                  >
                    Mua ngay <i className="fal fa-chevron-right ml-[5px]" aria-hidden="true" />
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
      className="lazy w-full"
      loading="lazy"
      suppressHydrationWarning
    />
  );

  return (
    <div className="banner-ads pt-15 pb-0 max-[1024px]:pt-13 max-md:pt-5 max-md:pb-2 max-md:px-[var(--bb-mobile-page-x)] max-md:bg-background">
      <div className="container !px-0 max-md:border max-md:border-border max-md:bg-card">
        <div className="row">
          <div className="col-md-12">
            {href ? <Link href={href}>{content}</Link> : content}
          </div>
        </div>
      </div>
    </div>
  );
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
    <div className="relative w-full max-w-full px-0 md:flex-[0_0_33.3333%] md:max-w-[33.3333%] md:px-[15px]">
      <div className="mb-[30px] bg-white [box-shadow:0_3px_6px_rgba(0,0,0,0.16)] max-md:border max-md:border-solid max-md:border-[#dddddd]">
        <div className="text-center">
          <Link
            className="lazy group block overflow-hidden bg-cover bg-no-repeat [transition:all_0.3s_ease]"
            href={href}
            style={src ? { backgroundImage: `url("${src}")` } : undefined}
          >
            {src ? (
              <img
                src={src}
                alt={safeText(article.coverImage?.alt, title)}
                className="lazy block !h-[215px] w-full max-w-full object-cover align-middle [transition:transform_0.3s_ease] max-[992px]:!h-[200px] max-[768px]:!h-[180px] min-[1920px]:!h-[290px] min-[2560px]:!h-[400px] group-hover:[transform:scale(1.03)]"
                loading="lazy"
              />
            ) : null}
          </Link>
        </div>
        <div className="relative max-md:bg-white">
          {dateStr && (
            <div className="absolute left-0 top-[-21px] w-[170px] max-md:top-[-17px] max-md:w-[132px]">
              <p className="relative m-0 p-0 pl-[20px] font-heading text-[14px] font-semibold uppercase leading-[42px] whitespace-nowrap bg-brand text-white after:absolute after:bottom-0 after:right-[-15px] after:h-[42px] after:w-[25px] after:bg-brand after:[transform:skewX(-20deg)] after:content-[''] max-md:pl-[14px] max-md:text-[12px] max-md:leading-[34px] max-md:after:right-[-11px] max-md:after:h-[34px] max-md:after:w-[19px]">
                {dateStr}
              </p>
            </div>
          )}
          <div className="[padding:40px_20px_30px] max-md:bg-white max-md:[padding:40px_16px_22px]">
            <p className="m-0 mb-[5px] font-heading text-[clamp(1.25rem,1.229rem_+_0.092vw,1.375rem)] font-semibold normal-case leading-[var(--bb-line-snug)] tracking-[normal] text-black">
              <Link href={href} className="text-black no-underline [transition:color_0.2s_ease] hover:text-brand max-md:font-cta max-md:text-[15px] max-md:leading-[1.25]">
                {title}
              </Link>
            </p>
            {excerpt ? (
              <p className="m-0 text-[length:var(--fs-body)] leading-[var(--bb-line-body)] text-black max-md:overflow-hidden max-md:[display:flow-root] max-md:[-webkit-line-clamp:3]">
                {excerpt}
              </p>
            ) : null}
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
  const homeVideos = (homeVideosResult.data ?? []).filter(isRenderableHomeVideo);
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

      <HomeCategoryHighlights items={homeHighlights} />

      {(aboutSubtitle || aboutTitle || aboutMarkup) && (
        <div className="about-bigbike py-10 max-md:pt-8">
          <div className="container">
            {(aboutSubtitle || aboutTitle) && (
              <div className="text-center mb-[40px] max-md:mb-[24px]">
                {aboutSubtitle ? <p className="bb-kicker">{aboutSubtitle}</p> : null}
                {aboutTitle ? (
                  <h2 className="m-0 text-black font-heading text-[length:var(--bb-text-section-title)] font-semibold leading-[1.2] tracking-normal uppercase">
                    {aboutTitle}
                  </h2>
                ) : null}
              </div>
            )}
            {aboutMarkup ? (
              <div
                className="block-content text-center max-w-[970px] mx-auto"
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
          <Container>
            <div className="bb-products-header flex flex-col items-center justify-center gap-0 m-0 mb-[40px] p-0 [border-bottom:0] text-foreground [text-align:center] max-md:mb-[14px] max-md:px-[var(--bb-mobile-page-x)] max-md:[text-align:left]">
              <p className="bb-kicker">Sản phẩm nổi bật</p>
              <h2
                id="home-products-heading"
                className="m-0 font-heading text-[length:var(--bb-text-section-title)] max-md:text-[length:var(--fs-h2)] font-semibold leading-[var(--bb-line-section-title)] max-md:leading-[1.08] tracking-normal uppercase text-black [text-align:center] max-md:max-w-full max-md:text-balance"
              >
                Sản phẩm nổi bật tại BigBike
              </h2>
            </div>
            <FeaturedProductsCarousel products={carouselProducts} />
            {categoriesResult.data.length > 0 && (
              <>
                <div className="block md:hidden">
                  <MobileCategoryGrid categories={categoriesResult.data} />
                </div>
                <div className="hidden md:block">
                  <div
                    className="grid grid-cols-4 min-[2560px]:grid-cols-6 gap-0 border-t border-l border-t-[#cecece] border-l-[#cecece] mt-[130px] max-[1024px]:mt-20 mb-2.5"
                    aria-label="Danh mục sản phẩm"
                  >
                    {categoriesResult.data.map((category) => (
                      <WpCategoryListItem key={category.id} category={category} />
                    ))}
                  </div>
                </div>
              </>
            )}
          </Container>
        </section>
      )}

      {carouselProducts.length === 0 && categoriesResult.data.length > 0 && (
        <section className="bb-products-section" aria-label="Danh mục sản phẩm">
          <Container>
            <div className="block md:hidden">
              <MobileCategoryGrid categories={categoriesResult.data} />
            </div>
            <div className="hidden md:block">
              <div className="grid grid-cols-4 min-[2560px]:grid-cols-6 gap-0 border-t border-l border-t-[#cecece] border-l-[#cecece] mt-0 mb-2.5">
                {categoriesResult.data.map((category) => (
                  <WpCategoryListItem key={category.id} category={category} />
                ))}
              </div>
            </div>
          </Container>
        </section>
      )}

      <PromoBanner
        imageSrc={promoImageSrc}
        href={promoHref}
        title={promoTitle}
        offLabel={promoOff}
      />

      {expArticles.length > 0 && (
        <section className="bb-experience bb-experience--home bg-background text-foreground pt-[100px] max-[1024px]:pt-[72px] max-md:pt-8 pb-0" aria-labelledby="home-exp-heading">
          {(expSubtitle || expTitle || expDesc) && (
            <div className="mx-auto w-full max-w-[var(--bb-container-xl)] px-[15px]">
              <div className="[text-align:center] max-md:[text-align:left] pb-10 max-md:pb-4">
                {expSubtitle ? (
                  <p className="bb-kicker">
                    {expSubtitle}
                  </p>
                ) : null}
                {expTitle ? (
                  <h2
                    id="home-exp-heading"
                    className="m-0 font-heading text-[length:var(--bb-text-section-title)] max-md:text-[length:var(--fs-h2)] font-semibold uppercase leading-[1.2] max-md:leading-[1.08] text-foreground max-md:max-w-full max-md:text-balance"
                  >
                    {expTitle}
                  </h2>
                ) : null}
                {expDesc ? (
                  <div className="mx-auto w-full pt-[30px] max-md:pt-4 max-md:px-[var(--bb-mobile-page-x)] md:w-2/3 min-[1200px]:max-w-[770px]">
                    <p className="text-[var(--bb-color-footer-top)] max-md:text-muted-foreground max-w-full m-0 text-base max-md:text-[15px] leading-[1.375] max-md:leading-[1.55]">
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
        <div className="bb-home-news-parity bg-white pb-0 pt-[60px] max-[1024px]:pt-[52px] max-[768px]:pt-[20px]">
          <div className="mx-auto w-full max-w-[1200px] px-[15px] min-[1536px]:max-w-[1360px] min-[1920px]:w-[min(100%_-_2_*_var(--bb-page-padding-desktop),100rem)] min-[1920px]:max-w-none min-[2560px]:w-[min(100%_-_2_*_var(--bb-page-padding-desktop),140rem)] max-md:max-w-none max-md:px-[var(--bb-mobile-page-x)]">
            <div className="px-0 pt-0 pb-[40px] [text-align:center] max-md:px-[var(--bb-mobile-page-x)] max-md:pb-[14px] max-md:[text-align:left]">
              <p className="bb-kicker">Tin tức & cập nhật</p>
              <h2 className="m-0 font-cta text-[clamp(1.75rem,1.45rem_+_1.281vw,3.5rem)] font-semibold uppercase leading-[1.15] tracking-[normal] text-black max-md:leading-[1.2]">
                Cập nhật xu hướng cùng BigBike
              </h2>
            </div>
            <div>
              <div className="-mx-[15px] flex flex-wrap max-md:mx-0 max-md:grid max-md:grid-cols-1 max-md:gap-4">
                {newsArticles.map((article) => (
                  <WpNewsCard key={article.id} article={article} />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {homeVideos.length > 0 && (
        <section className="videos-slide pt-20 pb-0 max-[1024px]:pt-16 max-md:pt-7 max-md:bg-background" aria-labelledby="home-video-heading">
          {/*
            Overlay strategy:
            - Layer 1 (before): solid dark base ở bottom-up để nền không flat
            - Layer 2 (after):  gradient top-down nhẹ để title area tối hơn, cards nổi
            Tổng mức tối ~60% — giữ mood mạnh mẽ nhưng sharp hơn black/40 cũ
          */}
          <div className="relative bg-[url('/wp/video-bg.jpg')] bg-cover bg-center bg-no-repeat pb-16 max-[1024px]:pb-13 max-md:pb-10 max-md:bg-[color:var(--bb-bg-surface-dark)] before:absolute before:inset-0 before:bg-black/55 before:content-[''] after:absolute after:inset-0 after:bg-gradient-to-b after:from-black/30 after:via-transparent after:to-black/25 after:content-['']">
            <div className="relative z-[1] mx-auto w-full max-w-[var(--bb-container-xl)] px-[15px]">
              <div className="text-center text-white pt-18 max-[1024px]:pt-12 max-md:pt-9 pb-13 max-[1024px]:pb-8 max-md:pb-5">
                <h2
                  id="home-video-heading"
                  className="my-0 mx-auto max-w-[820px] text-white font-heading text-[length:var(--fs-h1)] max-[1024px]:text-[length:var(--fs-h2)] max-md:text-[length:var(--fs-h3)] font-semibold leading-[1.12] max-[1024px]:leading-[1.1] max-md:leading-[1.12] tracking-normal uppercase text-balance drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)]"
                >
                  {/* Tách thành 2 cụm nghĩa, mỗi cụm không xuống dòng giữa chừng:
                      desktop lớn cho ra "TRẢI NGHIỆM SẢN PHẨM" / "CÙNG BIGBIKE.VN",
                      không bao giờ tách "SẢN PHẨM"; viewport hẹp vẫn wrap theo cụm gọn. */}
                  <span className="whitespace-nowrap">Trải nghiệm sản phẩm</span>{" "}
                  <span className="whitespace-nowrap">cùng BigBike.vn</span>
                </h2>
              </div>
              <HomeVideoCarousel videos={homeVideos} />
            </div>
          </div>
        </section>
      )}

      {brandsResult.data.length > 0 && (
        <div className="partner-slide pt-30 pb-30 max-[1024px]:pt-20 max-[1024px]:pb-20 max-md:pt-8 max-md:pb-6 max-md:px-[var(--bb-mobile-page-x)] max-md:bg-background max-md:text-foreground">
          <BrandCarousel brands={brandsResult.data} />
        </div>
      )}

      {homeContentBottomMarkup ? (
        <div className="content-bottom wyswyg bb-seo-content">
          <div
            className="container bb-seo-content-body"
            dangerouslySetInnerHTML={{ __html: homeContentBottomMarkup }}
          />
        </div>
      ) : null}

      <HomeAnalytics />
    </div>
  );
}
