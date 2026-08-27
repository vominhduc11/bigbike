import type { Metadata } from "next";
import Link from "@/i18n/StorefrontLink";
import { preload } from "react-dom";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { HomeAnalytics } from "@/components/home/HomeAnalytics";
import { Tr } from "@/components/i18n/Tr";
import { HeroSlider } from "@/components/home/HeroSlider";
import { toHeroSlide } from "@/components/home/heroSliderModel";
import { Container } from "@/components/layout/Container";
import { HomeCategoryGrid } from "@/components/home/HomeCategoryGrid";
import { HomeNewsList } from "@/components/home/HomeNewsList";
import {
  DeferredBrandCarousel,
  DeferredExperienceCarousel,
  DeferredHomeFeaturedProducts,
  DeferredHomeVideoCarousel,
} from "@/components/home/DeferredHomeCarousels";
import { MediaImage } from "@/components/ui/MediaImage";
import {
  HomeAboutSection,
  HomeBlockHeading,
  HomeContentBottom,
  HomeExperienceHeading,
} from "@/components/home/HomeLocalizedSettings";
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
} from "@/lib/utils/format";
import { sanitizeRichHtml } from "@/lib/utils/html";
import { pickSetting } from "@/lib/utils/settings";
import { toHomePath, toProductListPath, toProductPath, translatePath } from "@/lib/utils/routes";
import type { HomeVideo } from "@/lib/contracts/public";
import type { Locale } from "@/i18n/locale";

// ISR: render tĩnh + revalidate on-demand theo tag (home/products/sliders…) do backend
// WebRevalidationService phát khi admin đổi nội dung. Bỏ force-dynamic để không SSR.

const HOME_ORG_LOGO = "/wp/logo.png";
const DEFAULT_SITE_NAME = "BigBike";

// Nội dung 4 khối tĩnh trang chủ (nhóm setting `public_home`, gỡ khỏi Cài đặt admin
// 2026-07-03 — xem DATA_CONTRACT.md "public_home keys — removed"). Giá trị VI/EN giữ
// nguyên bản cuối cùng đã lưu trong DB trước khi gỡ; sửa sau này cần sửa thẳng code.
const PROMO_TITLE = "LS2 DUAL SPORT MX436 PIONEER";
const PROMO_OFF = "20% OFF";
const PROMO_IMAGE_SRC = "/brand/home/promo-banner.jpg";
const PROMO_ALT = `${PROMO_TITLE} — ${PROMO_OFF}`;

type HomePageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: HomePageProps): Promise<Metadata> {
  const { locale } = await params as Awaited<typeof params> & { locale: Locale };
  setRequestLocale(locale);
  const tHome = await getTranslations({ locale, namespace: "Home" });
  const settingsResult = await listPublicSettings(locale);
  const settings = settingsResult.data ?? [];
  const siteName = pickSetting(settings, ["site_name"]) || DEFAULT_SITE_NAME;
  const homeTitle = pickSetting(settings, ["seo_home_title"]) || siteName;
  const homeDescription = pickSetting(settings, ["seo_home_description"]) || tHome("metaDescription");

  return buildPublicMetadata({
    title: homeTitle,
    description: homeDescription,
    canonicalPath: toHomePath(locale),
    locale,
    languageAlternates: { vi: toHomePath("vi"), en: toHomePath("en") },
    siteName,
  });
}

function isRenderableHomeVideo(video: HomeVideo): boolean {
  // Backend already whitelists YouTube/TikTok/Facebook and only populates embedUrl for those
  // (null for self-hosted MinIO videos, which VideoModal renders straight from videoUrl).
  if (video.embedUrl) return true;
  return isSafeHomeVideoUrl(video.videoUrl);
}

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params as Awaited<typeof params> & { locale: Locale };
  setRequestLocale(locale);
  const tHome = await getTranslations({ locale, namespace: "Home" });
  const [
    slidersResult,
    categoriesResult,
    expPickedResult,
    expFallbackResult,
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
    listBrands({ page: 1, size: 12, sort: "name:asc", showOnHomepage: true, lang: locale }),
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
    if (slides[0].mobileSrc) {
      preload(slides[0].mobileSrc, {
        as: "image",
        fetchPriority: "high",
        media: "(max-width: 767px)",
      });
      preload(slides[0].desktopSrc, {
        as: "image",
        fetchPriority: "high",
        media: "(min-width: 768px)",
      });
    } else {
      preload(slides[0].desktopSrc, { as: "image", fetchPriority: "high" });
    }
  }

  const categories = categoriesResult.data ?? [];
  // Bài admin chọn tay được ưu tiên; nếu chưa chọn bài nào thì dùng 3 bài Reviews mới nhất.
  const expPicked = expPickedResult.data ?? [];
  const expArticles = expPicked.length > 0 ? expPicked : (expFallbackResult.data ?? []);
  const newsArticles = expFallbackResult.data ?? [];
  const brands = brandsResult.data ?? [];
  const carouselProducts = carouselProductsResult.data ?? [];
  const homeHighlights = homeHighlightsResult.data ?? [];
  const homeVideos = (homeVideosResult.data ?? []).filter(isRenderableHomeVideo);

  const aboutMarkup = sanitizeRichHtml(tHome.raw("aboutHtml"), { allowInlineStyles: true, rewriteMediaUrls: true, locale });
  const homeContentBottomMarkup = homeContentBottomHtml
    ? sanitizeRichHtml(homeContentBottomHtml, { allowInlineStyles: true, rewriteMediaUrls: true, locale })
    : "";

  const jsonLdOrg = serializeJsonLd(buildOrganizationJsonLd(siteName, HOME_ORG_LOGO, locale));
  const jsonLdWeb = serializeJsonLd(buildWebSiteJsonLd(siteName, translatePath("/tim-kiem/", locale), locale));
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
      areaServed: locale === "en" ? "Ho Chi Minh City" : "Thành phố Hồ Chí Minh",
      priceRange: "₫₫",
      locale,
      // Lấy từ đúng settings đang hiển thị cho khách — sửa giờ trong trang quản trị
      // là schema tự đổi theo, không phải sửa code. Dòng lễ/Tết không có giờ cụ thể
      // nên builder tự bỏ qua.
      openingHours: [
        pickSetting(settings, ["opening_hours_weekday"]),
        pickSetting(settings, ["opening_hours_weekend"]),
      ],
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
          <Container>
            <div data-home-highlight-grid className="grid grid-cols-1 gap-8 md:grid-cols-3">
              {homeHighlights.map((h) => {
                const img = toLegacyWpMediaUrl(resolveMediaUrl(h.productImageUrl));
                const href = toProductPath(h.productSlug, locale);
                return (
                  <article className="relative h-75 overflow-hidden border border-border bg-card p-8 uppercase" key={h.slot}>
                      <div className="absolute bottom-0 right-8">
                        <div data-home-highlight-image className="relative size-45">
                          <Link href={href} className="block size-full">
                            {img ? (
                              <MediaImage
                                image={{ url: img }}
                                altFallback={h.productName}
                                width={360}
                                height={360}
                                fill
                                sizes="180px"
                                className="object-contain"
                              />
                            ) : null}
                          </Link>
                        </div>
                      </div>
                      <h3 className="relative z-[1] mb-10 line-clamp-2 w-full font-body text-a4-content font-semibold leading-5 text-foreground">
                        <Link href={href} className="text-foreground hover:text-brand">{h.productName}</Link>
                      </h3>
                      <Link className="relative z-[1] inline-flex items-center gap-1 font-body text-a4-content font-semibold text-brand" href={href}>
                        <Tr ns="Home" k="buyNow" />
                      </Link>
                  </article>
                );
              })}
            </div>
          </Container>
        </section>
      )}

      {/* ===== 3. About bigbike (client localizer: swap EN settings sau khi đổi ngôn ngữ) ===== */}
      <HomeAboutSection
        subtitle={tHome("aboutSubtitle")}
        title={tHome("aboutTitle")}
        html={aboutMarkup}
      />

      {/* ===== 4. Product list + category grid ===== */}
      <section className="py-10">
        <Container>
          <HomeBlockHeading
            className="mb-10 text-center"
            kicker={tHome("featuredKicker")}
            title={tHome("featuredTitle")}
          />
          <DeferredHomeFeaturedProducts initialProducts={carouselProducts} />

          <HomeCategoryGrid initialCategories={categories} />
        </Container>
      </section>

      {/* ===== 5. Banner ads ===== */}
      <section className="pt-15">
        <Container>
          <Link href={toProductListPath(locale)} title={PROMO_TITLE} className="block">
            <MediaImage
              image={{ url: PROMO_IMAGE_SRC, alt: PROMO_ALT, width: 1170, height: 501 }}
              altFallback={PROMO_ALT}
              className="h-auto w-full"
              sizes="(min-width: 1200px) 1170px, calc(100vw - 32px)"
            />
          </Link>
        </Container>
      </section>

      {/* ===== 6. Content carousel (trải nghiệm/review) ===== */}
      {expArticles.length > 0 && (
        <section data-bb-full-bleed className="w-full pt-25">
          <HomeExperienceHeading
            subtitle={tHome("experienceSubtitle")}
            title={tHome("experienceTitle")}
            desc={tHome("experienceDescription")}
          />
          <div className="w-full">
            <DeferredExperienceCarousel articles={expArticles} />
          </div>
        </section>
      )}

      {/* ===== 7. News ===== */}
      {newsArticles.length > 0 && (
        <section className="pb-15 pt-10 max-md:pt-8">
          <Container>
            <HomeBlockHeading
              className="pb-10 text-center"
              kicker={tHome("newsKicker")}
              title={tHome("newsTitle")}
            />
            <HomeNewsList initialArticles={newsArticles} />
          </Container>
        </section>
      )}

      {/* ===== 8. Videos slide ===== */}
      {homeVideos.length > 0 && (
        <section data-bb-full-bleed className="relative overflow-hidden bg-surface-dark py-24 max-md:py-15">
          <div
            aria-hidden
            className="absolute inset-0 bg-cover bg-center bg-no-repeat [background-image:url('/wp/video-bg.jpg')] [filter:brightness(1.2)]"
          />
          <div className="relative z-[1] mx-auto w-full max-w-[var(--bb-container-xl)] px-4 md:px-6">
            <HomeBlockHeading
              className="pb-10 text-center [&_h2]:!text-white"
              title={tHome("videosTitle")}
            />
            <DeferredHomeVideoCarousel videos={homeVideos} />
          </div>
        </section>
      )}

      {/* ===== 9. Partner slide (thương hiệu) ===== */}
      <DeferredBrandCarousel brands={brands} />

      {/* ===== 10. Content bottom (SEO wyswyg) — client localizer ===== */}
      <div data-bb-focus="seo_home">
      <HomeContentBottom html={homeContentBottomMarkup} />
      </div>

      <HomeAnalytics />
    </>
  );
}
