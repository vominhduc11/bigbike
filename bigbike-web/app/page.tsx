import type { Metadata } from "next";
import Link from "next/link";
import { preload } from "react-dom";
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
import { ChevronRight } from "lucide-react";
import {
  HomeAboutSection,
  HomeBlockHeading,
  HomeContentBottom,
  HomeExperienceHeading,
} from "@/components/home/HomeLocalizedSettings";
import type { HomeSlider } from "@/lib/contracts/public";
import {
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
  resolveMediaUrl,
  toLegacyWpMediaUrl,
  toSafePublicHref,
} from "@/lib/utils/format";
import { sanitizeRichHtml } from "@/lib/utils/html";
import { pickSetting } from "@/lib/utils/settings";
import { toHomePath, toProductPath } from "@/lib/utils/routes";
import type { HomeVideo } from "@/lib/contracts/public";

// ISR: render tĩnh + revalidate on-demand theo tag (home/products/sliders…) do backend
// WebRevalidationService phát khi admin đổi nội dung. Bỏ force-dynamic để không SSR.

const HOME_ORG_LOGO = "/wp/logo.png";
const DEFAULT_SITE_NAME = "BigBike";

// Nội dung 4 khối tĩnh trang chủ (nhóm setting `public_home`, gỡ khỏi Cài đặt admin
// 2026-07-03 — xem DATA_CONTRACT.md "public_home keys — removed"). Giá trị VI/EN giữ
// nguyên bản cuối cùng đã lưu trong DB trước khi gỡ; sửa sau này cần sửa thẳng code.
const PROMO_TITLE = "LS2 DUAL SPORT MX436 PIONEER";
const PROMO_OFF = "20% OFF";
const PROMO_HREF = "/san-pham";
const PROMO_IMAGE_SRC = "/brand/home/promo-banner.jpg";
const PROMO_ALT = `${PROMO_TITLE} — ${PROMO_OFF}`;

const EXP_SUBTITLE_VI = "GÓC TRẢI NGHIỆM CÙNG BIGBIKE";
const EXP_SUBTITLE_EN = "EXPERIENCE CORNER WITH BIGBIKE";
const EXP_TITLE_VI = "PHỤ KIỆN ĐI PHƯỢT MOTO CAO CẤP";
const EXP_TITLE_EN = "PREMIUM MOTORCYCLE TOURING GEAR";
const EXP_DESC_VI =
  "Tại shop bán đồ phượt moto Bigbike, các sản phẩm đồ bảo hộ moto và phụ kiện phượt rất đa dạng về mẫu mã và kiểu dáng với giá cả vô cùng phải chăng. Ngoài ra, đội ngũ nhân viên của cửa hàng rất am hiểu sản phẩm, sẵn sàng tư vấn và chăm sóc khách hàng khi cần thiết.";
const EXP_DESC_EN =
  "At Bigbike, our motorcycle protective gear and touring accessories come in a wide variety of styles and designs at remarkably affordable prices. Our staff know the products inside out and are always ready to advise and take care of customers whenever needed.";

const ABOUT_TITLE_VI = "SHOP BẢO HỘ MOTO UY TÍN";
const ABOUT_TITLE_EN = "TRUSTED MOTORCYCLE GEAR SHOP";
const ABOUT_SUBTITLE_VI = "BIGBIKE";
const ABOUT_SUBTITLE_EN = "";
const ABOUT_HTML_VI =
  '<p><span style="font-weight: 400;">Bigbike tự hào là một trong những shop chuyên bán đồ phượt, đồ bảo hộ moto đáng tin cậy tại TP HCM được nhiều anh em biker tin tưởng lựa chọn. Chúng tôi chuyên cung cấp đa dạng các dòng sản phẩm đồ phượt moto, phụ kiện phượt, đồ bảo hộ chính hãng từ nhiều thương hiệu nổi tiếng trên thế giới.</span></p>';
const ABOUT_HTML_EN =
  '<p><span style="font-weight: 400;">Bigbike is proud to be one of the most trusted shops for touring and motorcycle protective gear in Ho Chi Minh City, chosen by countless riders. We specialize in a wide range of motorcycle touring gear, riding accessories and genuine protective equipment from leading brands around the world.</span></p>';

const FEATURED_KICKER_VI = "SẢN PHẨM NỔI BẬT";
const FEATURED_KICKER_EN = "FEATURED PRODUCTS";
const FEATURED_TITLE_VI = "SẢN PHẨM NỔI BẬT TẠI BIGBIKE";
const FEATURED_TITLE_EN = "FEATURED PRODUCTS AT BIGBIKE";
const NEWS_KICKER_VI = "TIN TỨC MỚI UPDATE";
const NEWS_KICKER_EN = "LATEST NEWS";
const NEWS_TITLE_VI = "CẬP NHẬT XU HƯỚNG CÙNG BIGBIKE";
const NEWS_TITLE_EN = "STAY UPDATED WITH BIGBIKE";
const VIDEOS_TITLE_VI = "TRẢI NGHIỆM SẢN PHẨM CÙNG BIGBIKE.VN";
const VIDEOS_TITLE_EN = "EXPERIENCE OUR PRODUCTS WITH BIGBIKE.VN";

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

function toHeroSlide(slider: HomeSlider): HeroSlide | null {
  const desktopSrc = toLegacyWpMediaUrl(resolveMediaUrl(slider.desktopImage?.url?.trim()));
  if (!desktopSrc) return null;

  // Banner WP: desktop dùng ảnh nền, mobile (≤767px) dùng ảnh riêng nếu có,
  // fallback về ảnh desktop.
  const mobileSrc = toLegacyWpMediaUrl(resolveMediaUrl(slider.mobileImage?.url?.trim())) || desktopSrc;
  const productName = slider.productName?.trim() ?? "";
  const categoryName = slider.categoryName?.trim() ?? "";

  return {
    id: slider.id,
    desktopSrc,
    mobileSrc,
    alt: productName || categoryName || "BigBike",
    href: toSafePublicHref(slider.link || slider.productLink || slider.externalLink, "") || null,
    productName,
    categoryName,
    productCode: slider.sku?.trim() || "BIGBIKE",
  };
}

function isRenderableHomeVideo(video: HomeVideo): boolean {
  // Backend already whitelists YouTube/TikTok/Facebook and only populates embedUrl for those
  // (null for self-hosted MinIO videos, which VideoModal renders straight from videoUrl).
  if (video.embedUrl) return true;
  return isSafeHomeVideoUrl(video.videoUrl);
}

export default async function HomePage() {
  const locale = await getLocale();
  const [
    slidersResult,
    categoriesResult,
    expPickedResult,
    expFallbackResult,
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
    // "Góc trải nghiệm": ưu tiên các bài admin chọn tay (homeExperience=true), tối đa 3, mới nhất trước.
    listArticles({ page: 1, homeExperience: true, size: 3, sort: "publishedAt:desc", lang: locale }),
    // Dự phòng khi admin chưa chọn bài nào: 3 bài viết mới nhất (sau khi gộp nhóm còn 1 "Tin tức").
    listArticles({ page: 1, size: 3, sort: "publishedAt:desc", lang: locale }),
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
  const homeContentBottomHtml = pickSetting(settings, ["home_content_bottom_html"]);

  const rawSliders = slidersResult.data ?? [];
  const slides = rawSliders
    .map((slider) => toHeroSlide(slider))
    .filter((s): s is NonNullable<typeof s> => s !== null);
  // The hero banner is the page's LCP element, but React's automatic SSR image
  // preload skips anything inside a <picture> (HeroSlider wraps its <img> in one
  // for mobile/desktop art direction) — so without this it was the one image on
  // the page that DIDN'T get preloaded while everything below the fold did.
  // Explicit high-priority preload compensates.
  if (slides[0]) {
    preload(slides[0].desktopSrc, { as: "image", fetchPriority: "high" });
  }

  const categories = categoriesResult.data ?? [];
  // Bài admin chọn tay được ưu tiên; nếu chưa chọn bài nào thì dùng 3 bài Reviews mới nhất.
  const expPicked = expPickedResult.data ?? [];
  const expArticles = expPicked.length > 0 ? expPicked : (expFallbackResult.data ?? []);
  const newsArticles = newsArticlesResult.data ?? [];
  const brands = brandsResult.data ?? [];
  const carouselProducts = carouselProductsResult.data ?? [];
  const homeHighlights = homeHighlightsResult.data ?? [];
  const homeVideos = (homeVideosResult.data ?? []).filter(isRenderableHomeVideo);

  const aboutMarkupVi = sanitizeRichHtml(ABOUT_HTML_VI, { allowInlineStyles: true, rewriteMediaUrls: true });
  const aboutMarkupEn = sanitizeRichHtml(ABOUT_HTML_EN, { allowInlineStyles: true, rewriteMediaUrls: true });
  const homeContentBottomMarkup = homeContentBottomHtml
    ? sanitizeRichHtml(homeContentBottomHtml, { allowInlineStyles: true, rewriteMediaUrls: true })
    : "";

  const jsonLdOrg = serializeJsonLd(buildOrganizationJsonLd(siteName, HOME_ORG_LOGO));
  const jsonLdWeb = serializeJsonLd(buildWebSiteJsonLd(siteName));
  // Hồ sơ chính thức (sameAs) lấy từ settings công khai — không hardcode.
  const sameAsProfiles = [
    pickSetting(settings, ["facebook_url"]),
    pickSetting(settings, ["youtube_url"]),
    pickSetting(settings, ["tiktok_url"]),
    pickSetting(settings, ["instagram_url"]),
    pickSetting(settings, ["shopee_url"]),
    pickSetting(settings, ["zalo_url"]),
  ].filter(Boolean);
  const jsonLdLocalBusiness = serializeJsonLd(
    buildLocalBusinessJsonLd(siteName, HOME_ORG_LOGO, address, hotline, {
      email: pickSetting(settings, ["contact_email"]) || undefined,
      sameAs: sameAsProfiles,
      foundingDate: "2014",
      areaServed: "Thành phố Hồ Chí Minh",
      priceRange: "₫₫",
    }),
  );

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdOrg }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdWeb }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdLocalBusiness }} />

      {/* ===== 1. Main banner ===== */}
      <HeroSlider slides={slides} />

      {/* ===== 2. Category list (3 sản phẩm nổi bật) ===== */}
      {homeHighlights.length > 0 && (
        <section className="py-15">
          <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              {homeHighlights.map((h) => {
                const img = toLegacyWpMediaUrl(resolveMediaUrl(h.productImageUrl));
                const href = toProductPath(h.productSlug);
                return (
                  <article className="relative h-75 overflow-hidden border border-border bg-card p-8 uppercase" key={h.slot}>
                      <div className="absolute bottom-0 right-8">
                        <Link href={href}>
                          {img ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={img} loading="lazy" className="max-h-45 w-auto max-w-full object-contain" alt={h.productName} />
                          ) : null}
                        </Link>
                      </div>
                      <h3 className="relative z-[1] mb-10 max-w-3/5 font-body text-a4-content font-semibold leading-5 text-foreground">
                        <Link href={href} className="text-foreground hover:text-brand">{h.productName}</Link>
                      </h3>
                      <Link className="relative z-[1] inline-flex items-center gap-1 font-body text-a4-content font-semibold text-brand" href={href}>
                        <Tr ns="Home" k="buyNow" /> <ChevronRight className="h-4 w-4" aria-hidden="true" />
                      </Link>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ===== 3. About bigbike (client localizer: swap EN settings sau khi đổi ngôn ngữ) ===== */}
      <HomeAboutSection
        subtitle={ABOUT_SUBTITLE_VI}
        subtitleEn={ABOUT_SUBTITLE_EN}
        title={ABOUT_TITLE_VI}
        titleEn={ABOUT_TITLE_EN}
        viHtml={aboutMarkupVi}
        enHtml={aboutMarkupEn}
      />

      {/* ===== 4. Product list + category grid ===== */}
      <section className="py-10">
        <div className="mx-auto w-full max-w-[1200px] px-4">
          <HomeBlockHeading
            className="mb-10 text-center"
            kicker={FEATURED_KICKER_VI}
            kickerEn={FEATURED_KICKER_EN}
            title={FEATURED_TITLE_VI}
            titleEn={FEATURED_TITLE_EN}
          />
          <HomeFeaturedProducts initialProducts={carouselProducts} />

          <HomeCategoryGrid initialCategories={categories} />
        </div>
      </section>

      {/* ===== 5. Banner ads ===== */}
      <section className="pt-15">
        <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6">
              <Link href={PROMO_HREF} title={PROMO_TITLE} className="block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="h-auto w-full" src={PROMO_IMAGE_SRC} alt={PROMO_ALT} loading="lazy" />
              </Link>
        </div>
      </section>

      {/* ===== 6. Content carousel (trải nghiệm/review) ===== */}
      {expArticles.length > 0 && (
        <section className="pt-25">
          <HomeExperienceHeading
            subtitle={EXP_SUBTITLE_VI}
            subtitleEn={EXP_SUBTITLE_EN}
            title={EXP_TITLE_VI}
            titleEn={EXP_TITLE_EN}
            desc={EXP_DESC_VI}
            descEn={EXP_DESC_EN}
          />
          <div className="w-full">
            <ExperienceCarousel articles={expArticles} />
          </div>
        </section>
      )}

      {/* ===== 7. News ===== */}
      {newsArticles.length > 0 && (
        <section className="py-15">
          <div className="mx-auto w-full max-w-[1200px] px-4 sm:px-6">
            <HomeBlockHeading
              className="pb-10 text-center"
              kicker={NEWS_KICKER_VI}
              kickerEn={NEWS_KICKER_EN}
              title={NEWS_TITLE_VI}
              titleEn={NEWS_TITLE_EN}
            />
            <HomeNewsList initialArticles={newsArticles} />
          </div>
        </section>
      )}

      {/* ===== 8. Videos slide ===== */}
      {homeVideos.length > 0 && (
        <section className="relative overflow-hidden bg-surface-dark py-24 max-md:py-15">
          <div
            aria-hidden
            className="absolute inset-0 bg-cover bg-center bg-no-repeat [background-image:url('/wp/video-bg.jpg')] [filter:brightness(1.2)]"
          />
          <div className="relative z-[1] mx-auto w-full max-w-[var(--bb-container-xl)] px-4 md:px-6">
            <HomeBlockHeading
              className="pb-10 text-center [&_h2]:!text-white"
              title={VIDEOS_TITLE_VI}
              titleEn={VIDEOS_TITLE_EN}
            />
            <HomeVideoCarousel videos={homeVideos} />
          </div>
        </section>
      )}

      {/* ===== 9. Partner slide (thương hiệu) ===== */}
      <BrandCarousel brands={brands} />

      {/* ===== 10. Content bottom (SEO wyswyg) — client localizer ===== */}
      <div data-bb-focus="seo_home">
        <HomeContentBottom viHtml={homeContentBottomMarkup} />
      </div>

      <HomeAnalytics />
    </>
  );
}
