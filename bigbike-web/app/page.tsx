import type { Metadata } from "next";
import Link from "next/link";
import { getLocale } from "next-intl/server";

import { HomeAnalytics } from "@/components/home/HomeAnalytics";
import { Tr } from "@/components/i18n/Tr";
import { ExperienceCarousel } from "@/components/home/ExperienceCarousel";
import { HomeVideoCarousel } from "@/components/home/HomeVideoCarousel";
import { BrandCarousel } from "@/components/home/BrandCarousel";
import { HeroSlider, type HeroSlide } from "@/components/home/HeroSlider";
import { HomeFeaturedProducts } from "@/components/home/HomeFeaturedProducts";
import { HomeCategoryGrid } from "@/components/home/HomeCategoryGrid";
import { HomeNewsList } from "@/components/home/HomeNewsList";
import {
  HomeAboutSection,
  HomeContentBottom,
  HomeExperienceHeading,
} from "@/components/home/HomeLocalizedSettings";
import { WpThemeStylesheet } from "@/components/wp/WpThemeStylesheet";
import type { HomeSlider, Product } from "@/lib/contracts/public";
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
  toLegacyWpMediaUrl,
  toSafePublicHref,
} from "@/lib/utils/format";
import { sanitizeRichHtml } from "@/lib/utils/html";
import { pickSetting } from "@/lib/utils/settings";
import {
  toCategoryPath,
  toHomePath,
  toProductListPath,
  toProductPath,
} from "@/lib/utils/routes";
import type { HomeVideo } from "@/lib/contracts/public";

// ISR: render tĩnh + revalidate on-demand theo tag (home/products/sliders…) do backend
// WebRevalidationService phát khi admin đổi nội dung. Bỏ force-dynamic để không SSR.

const T = "/wp-content/themes/bigbike";
const HOME_ORG_LOGO = "/wp/logo.png";
const DEFAULT_SITE_NAME = "BigBike";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const settingsResult = await listPublicSettings(locale);
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

function toHeroSlide(slider: HomeSlider, product: Product | null): HeroSlide | null {
  const desktopSrc = toLegacyWpMediaUrl(resolveMediaUrl(slider.desktopImage?.url?.trim()));
  if (!desktopSrc) return null;

  // Banner WP: desktop dùng ảnh nền, mobile (≤767px) dùng ảnh riêng nếu có,
  // fallback về ảnh desktop.
  const mobileSrc = toLegacyWpMediaUrl(resolveMediaUrl(slider.mobileImage?.url?.trim())) || desktopSrc;
  const productName = product?.name?.trim() ?? "";
  const categoryName = product?.category?.name?.trim() ?? "";

  return {
    id: slider.id,
    desktopSrc,
    mobileSrc,
    alt: productName || categoryName || "BigBike",
    href: toSafePublicHref(
      slider.link || slider.productLink || slider.externalLink,
      toProductListPath(),
    ),
    productName,
    categoryName,
    productCode: product?.sku?.trim() || "BIGBIKE",
  };
}

function isRenderableHomeVideo(video: HomeVideo): boolean {
  if (video.youtubeId && /^[A-Za-z0-9_-]{11}$/.test(video.youtubeId)) return true;
  return isSafeHomeVideoUrl(video.videoUrl);
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
    listArticles({ page: 1, category: "reviews", size: 3, sort: "publishedAt:desc", lang: locale }),
    listArticles({ page: 1, category: "tin-tuc", size: 3, sort: "publishedAt:desc", lang: locale }),
    listBrands({ page: 1, size: 12, sort: "name:asc", lang: locale }),
    listPublicSettings(locale),
    listProducts({
      page: 1,
      homepageBlock: "FEATURED_GRID",
      size: 12,
      sort: "homepageOrder:asc",
      lang: locale,
    }),
    listHomeVideos(locale),
    listHomeHighlights(locale),
  ]);

  const settings = settingsResult.data ?? [];
  const siteName = pickSetting(settings, ["site_name"]) || DEFAULT_SITE_NAME;
  const hotline = pickSetting(settings, ["hotline", "phone"]);
  const address = pickSetting(settings, ["contact_address", "address"]);
  const aboutTitle = pickSetting(settings, ["about_title"]);
  const aboutSubtitle = pickSetting(settings, ["about_subtitle", "site_name"]);
  const aboutHtml = pickSetting(settings, ["about_content_html"]);
  const homeContentBottomHtml = pickSetting(settings, ["home_content_bottom_html"]);
  const expSubtitle = pickSetting(settings, ["home_exp_subtitle"]);
  const expTitle = pickSetting(settings, ["home_exp_title"]);
  const expDesc = pickSetting(settings, ["home_exp_desc"]);
  const promoHrefValue = pickSetting(settings, ["promo_href"]);
  const promoImageValue = pickSetting(settings, ["promo_image_url"]);
  // promo_title / promo_off do admin sửa được — dùng làm alt + tooltip ảnh banner
  // (ảnh banner đã chứa chữ khuyến mãi, nên không overlay để tránh trùng/vỡ thiết kế).
  const promoTitle = pickSetting(settings, ["promo_title"]);
  const promoOff = pickSetting(settings, ["promo_off"]);
  const promoAlt = [promoTitle, promoOff].filter(Boolean).join(" — ") || "banner khuyến mãi";
  // Tiêu đề các khu trang chủ (admin sửa được), fallback copy theme khi trống.
  const featuredKicker = pickSetting(settings, ["home_featured_kicker"]);
  const featuredTitle = pickSetting(settings, ["home_featured_title"]);
  const newsKicker = pickSetting(settings, ["home_news_kicker"]);
  const newsTitle = pickSetting(settings, ["home_news_title"]);
  const videosTitle = pickSetting(settings, ["home_videos_title"]);

  const rawSliders = slidersResult.data ?? [];
  const sliderProducts = await Promise.all(
    rawSliders.map((slider) => {
      const slug = sliderProductSlug(slider);
      return slug ? getProductBySlug(slug, locale) : Promise.resolve(null);
    }),
  );
  const slides = rawSliders
    .map((slider, index) => toHeroSlide(slider, sliderProducts[index]?.data ?? null))
    .filter((s): s is NonNullable<typeof s> => s !== null);

  const categories = categoriesResult.data ?? [];
  const expArticles = expArticlesResult.data ?? [];
  const newsArticles = newsArticlesResult.data ?? [];
  const brands = brandsResult.data ?? [];
  const carouselProducts = carouselProductsResult.data ?? [];
  const homeHighlights = homeHighlightsResult.data ?? [];
  const homeVideos = (homeVideosResult.data ?? []).filter(isRenderableHomeVideo);

  const aboutMarkup = aboutHtml
    ? sanitizeRichHtml(aboutHtml, { allowInlineStyles: true, rewriteMediaUrls: true })
    : "";
  const homeContentBottomMarkup = homeContentBottomHtml
    ? sanitizeRichHtml(homeContentBottomHtml, { allowInlineStyles: true, rewriteMediaUrls: true })
    : "";
  const promoImageSrc =
    toLegacyWpMediaUrl(resolveMediaUrl(promoImageValue)) || `${T}/images/banner-ads.jpg`;
  const promoHref = isSafePublicHref(promoHrefValue) ? promoHrefValue.trim() : null;

  const jsonLdOrg = serializeJsonLd(buildOrganizationJsonLd(siteName, HOME_ORG_LOGO));
  const jsonLdWeb = serializeJsonLd(buildWebSiteJsonLd(siteName));
  const jsonLdLocalBusiness = serializeJsonLd(
    buildLocalBusinessJsonLd(siteName, HOME_ORG_LOGO, address, hotline),
  );

  return (
    <>
      {/* CSS theme WP nạp từ public/ (không qua Turbopack — file minified làm bundler nghẽn).
          WpThemeStylesheet tự gỡ bundle trang cũ khi điều hướng client → mọi trang hiển thị
          nhất quán như khi F5 (React Float KHÔNG tự gỡ stylesheet giữa các route). */}
      <WpThemeStylesheet href="/wp-content/themes/bigbike/css/wp-theme-home.css?v=2" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdOrg }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdWeb }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdLocalBusiness }} />

      {/* ===== 1. Main banner ===== */}
      <HeroSlider slides={slides} />

      {/* ===== 2. Category list (3 sản phẩm nổi bật) ===== */}
      {homeHighlights.length > 0 && (
        <div className="category-list">
          <div className="container">
            <div className="row">
              {homeHighlights.map((h) => {
                const img = toLegacyWpMediaUrl(resolveMediaUrl(h.productImageUrl));
                const href = toProductPath(h.productSlug);
                return (
                  <div className="col-md-4" key={h.slot}>
                    <div className="item">
                      <div className="item--thumbnail">
                        <Link href={href}>
                          {img ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={img} loading="lazy" className="-swiper-lazy lazy" alt={h.productName} />
                          ) : null}
                        </Link>
                      </div>
                      {h.categoryName ? (
                        <Link className="item--category" href={toCategoryPath(h.categorySlug)}>
                          {h.categoryName}
                        </Link>
                      ) : null}
                      <h3 className="item--title">
                        <Link href={href}>{h.productName}</Link>
                      </h3>
                      <Link className="item--btn" href={href}>
                        <Tr ns="Home" k="buyNow" /> <i className="fal fa-chevron-right" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ===== 3. About bigbike (client localizer: swap EN settings sau khi đổi ngôn ngữ) ===== */}
      <HomeAboutSection subtitle={aboutSubtitle} title={aboutTitle} viHtml={aboutMarkup} />

      {/* ===== 4. Product list + category grid ===== */}
      <div className="product-list pt-40 pb-40">
        <div className="container">
          <div className="block-title text-center mb-40">
            <p className="sub-title">{featuredKicker || <Tr ns="Home" k="featuredKicker" />}</p>
            <h3>{featuredTitle || <Tr ns="Home" k="featuredTitle" />}</h3>
          </div>
          <HomeFeaturedProducts initialProducts={carouselProducts} />

          <HomeCategoryGrid initialCategories={categories} />
        </div>
      </div>

      {/* ===== 5. Banner ads ===== */}
      <div className="banner-ads pt-60">
        <div className="container">
          <div className="row">
            <div className="col-md-12">
              <a href={promoHref ?? "#"} title={promoTitle || undefined}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="lazy" src={promoImageSrc} alt={promoAlt} />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* ===== 6. Content carousel (trải nghiệm/review) ===== */}
      {expArticles.length > 0 && (
        <div className="content-carousel pt-100">
          <HomeExperienceHeading subtitle={expSubtitle} title={expTitle} desc={expDesc} />
          <div className="container mw-1920">
            <ExperienceCarousel articles={expArticles} />
          </div>
        </div>
      )}

      {/* ===== 7. News ===== */}
      {newsArticles.length > 0 && (
        <div className="news bb-home-news-parity pt-60 pb-60">
          <div className="container">
            <div className="block-title text-center pb-40">
              <p className="sub-title">{newsKicker || <Tr ns="Home" k="newsKicker" />}</p>
              <h3>{newsTitle || <Tr ns="Home" k="newsTitle" />}</h3>
            </div>
            <HomeNewsList initialArticles={newsArticles} />
          </div>
        </div>
      )}

      {/* ===== 8. Videos slide ===== */}
      {homeVideos.length > 0 && (
        <section className="relative overflow-hidden bg-[#111] py-[90px] max-md:py-[60px]">
          <div
            aria-hidden
            className="absolute inset-0 bg-cover bg-center bg-no-repeat [background-image:url('/wp/video-bg.jpg')] [filter:brightness(1.2)]"
          />
          <div className="relative z-[1] mx-auto w-full max-w-[var(--bb-container-xl)] px-4 md:px-6">
            <div className="block-title text-center white pb-40">
              <h3>{videosTitle || <Tr ns="Home" k="videosTitle" />}</h3>
            </div>
            <HomeVideoCarousel videos={homeVideos} />
          </div>
        </section>
      )}

      {/* ===== 9. Partner slide (thương hiệu) ===== */}
      <BrandCarousel brands={brands} />

      {/* ===== 10. Content bottom (SEO wyswyg) — client localizer ===== */}
      <HomeContentBottom viHtml={homeContentBottomMarkup} />

      <HomeAnalytics />
    </>
  );
}
