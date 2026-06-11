import type { Metadata } from "next";
import Link from "next/link";
import { getLocale } from "next-intl/server";

import { HomeAnalytics } from "@/components/home/HomeAnalytics";
import { ExperienceCarousel } from "@/components/home/ExperienceCarousel";
import { HomeVideoCarousel } from "@/components/home/HomeVideoCarousel";
import { ProductSwiper } from "@/components/catalog/ProductSwiper";
import type { Article, HomeSlider, Product } from "@/lib/contracts/public";
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
import type { HomeVideo } from "@/lib/contracts/public";

export const dynamic = "force-dynamic";

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

function toHeroSlide(slider: HomeSlider, product: Product | null) {
  const desktopSrc = toLegacyWpMediaUrl(resolveMediaUrl(slider.desktopImage?.url?.trim()));
  if (!desktopSrc) return null;

  // Banner WP: desktop dùng background của <a>, mobile (≤767px) dùng <span>.
  // Khi slider có ảnh mobile riêng thì <span> dùng ảnh đó, fallback về ảnh desktop.
  const mobileSrc = toLegacyWpMediaUrl(resolveMediaUrl(slider.mobileImage?.url?.trim())) || desktopSrc;

  return {
    id: slider.id,
    src: desktopSrc,
    mobileSrc,
    href: toSafePublicHref(
      slider.link || slider.productLink || slider.externalLink,
      toProductListPath(),
    ),
    productCode: product?.sku?.trim() || "BIGBIKE",
  };
}

function isRenderableHomeVideo(video: HomeVideo): boolean {
  if (video.youtubeId && /^[A-Za-z0-9_-]{11}$/.test(video.youtubeId)) return true;
  return isSafeHomeVideoUrl(video.videoUrl);
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

/** get_the_date('j/n/Y') — ngày/tháng/năm không số 0 đầu. */
function formatWpDate(value: string | null | undefined): string {
  const date = new Date(value ?? "");
  if (Number.isNaN(date.valueOf())) return "";
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
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
          precedence để Next hoist vào <head> và tự gỡ khi rời route. */}
      <link
        rel="stylesheet"
        href="/wp-content/themes/bigbike/css/wp-theme-home.css?v=2"
        precedence="default"
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdOrg }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdWeb }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdLocalBusiness }} />

      {/* ===== 1. Main banner ===== */}
      <div id="main-banner">
        <div className="swiper-container js-home-banner">
          <div className="swiper-wrapper">
            {slides.map((s) => (
              <div className="swiper-slide" key={s.id} {...{ "product-code": s.productCode }}>
                <a
                  href={s.href}
                  style={{ background: `url('${s.src}')`, backgroundSize: "cover" }}
                  className="-swiper-lazy"
                >
                  <span style={{ backgroundImage: `url('${s.mobileSrc}')` }} />
                </a>
              </div>
            ))}
          </div>
          <div className="swiper-pagination" />
          <div className="swiper-button-next" />
          <div className="swiper-button-prev" />
        </div>
      </div>

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
                        Mua ngay <i className="fal fa-chevron-right" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ===== 3. About bigbike ===== */}
      {(aboutSubtitle || aboutTitle || aboutMarkup) && (
        <div className="about-bigbike">
          <div className="container">
            <div className="block-title text-center mb-40">
              {aboutSubtitle ? <p className="sub-title">{aboutSubtitle}</p> : null}
              {aboutTitle ? <h3>{aboutTitle}</h3> : null}
            </div>
            {aboutMarkup ? (
              <div
                className="block-content text-center"
                dangerouslySetInnerHTML={{ __html: aboutMarkup }}
              />
            ) : null}
          </div>
        </div>
      )}

      {/* ===== 4. Product list + category grid ===== */}
      <div className="product-list pt-40 pb-40">
        <div className="container">
          <div className="block-title text-center mb-40">
            <p className="sub-title">SẢN PHẨM NỔI BẬT</p>
            <h3>SẢN PHẨM NỔI BẬT TẠI BIGBIKE</h3>
          </div>
          {carouselProducts.length > 0 && <ProductSwiper products={carouselProducts} />}

          {categories.length > 0 && (
            <div className="product-category-list mb-10">
              <div className="row">
                {categories.map((c) => {
                  const img =
                    resolveMediaUrl((c.image ?? c.icon)?.url?.trim()) || `${T}/images/Union-2.png`;
                  return (
                    <div className="col-6 col-md-3 col-sm-4 item" key={c.id}>
                      <Link href={toCategoryPath(c.slug)} className="row align-items-center">
                        <span className="col-12">
                          <span className="img">
                            {/* mx-auto: căn giữa lại ảnh — Tailwind preflight ép img thành block
                                nên text-align:center của theme không còn căn giữa được (WP gốc img inline). */}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={img} className="lazy mx-auto" alt="" width={1} height={1} />
                          </span>
                          <span className="desc">{c.name}</span>
                          <i className="fal fa-chevron-circle-right" />
                        </span>
                      </Link>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ===== 5. Banner ads ===== */}
      <div className="banner-ads pt-60">
        <div className="container">
          <div className="row">
            <div className="col-md-12">
              <a href={promoHref ?? "#"}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="lazy" src={promoImageSrc} alt="" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* ===== 6. Content carousel (trải nghiệm/review) ===== */}
      {expArticles.length > 0 && (
        <div className="content-carousel pt-100">
          {(expSubtitle || expTitle || expDesc) && (
            <div className="container">
              <div className="block-title text-center pb-40">
                {expSubtitle ? <p className="sub-title">{expSubtitle}</p> : null}
                {expTitle ? <h3>{expTitle}</h3> : null}
                {expDesc ? (
                  <div className="row pt-30">
                    <div className="col-md-8 offset-md-2">
                      <div className="block-title--content">{expDesc}</div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}
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
              <p className="sub-title">TIN TỨC MỚI UPDATE</p>
              <h3>CẬP NHẬT XU HƯỚNG CÙNG BIGBIKE</h3>
            </div>
            <div className="news-list">
              <div className="row">
                {newsArticles.map((a) => {
                  const img = toLegacyWpMediaUrl(resolveMediaUrl(a.coverImage?.url?.trim()));
                  const href = toArticlePath(a.slug);
                  const title = safeText(a.title, "");
                  return (
                    <div className="col-md-4 col-sm-6" key={a.id}>
                      <div className="news--item">
                        <div className="news--item-thumbnail">
                          <Link className="lazy" href={href}>
                            {img ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={img} alt={title} className="lazy" />
                            ) : null}
                          </Link>
                        </div>
                        <div className="news--item-desc">
                          <div className="news-date">
                            <p>{formatWpDate(a.publishedAt ?? a.createdAt)}</p>
                          </div>
                          <div className="news--item-inside">
                            <p className="title-post">
                              <Link href={href}>{title}</Link>
                            </p>
                            <p>{resolveWpNewsExcerpt(a)}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
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
              <h3>TRẢI NGHIỆM SẢN PHẨM CÙNG BIGBIKE.VN</h3>
            </div>
            <HomeVideoCarousel videos={homeVideos} />
          </div>
        </section>
      )}

      {/* ===== 9. Partner slide (thương hiệu) ===== */}
      {brands.length > 0 && (
        <div className="partner-slide pt-120 pb-120">
          <div className="container">
            {/* suppressHydrationWarning: home.min.js (Swiper + jQuery) mutates these
                elements after load — navigation overlays and lazy-load markers cause
                intentional DOM divergence from server HTML. */}
            <div className="swiper-container" suppressHydrationWarning>
              <div className="swiper-wrapper" suppressHydrationWarning>
                {brands.map((b) => {
                  const logo = toLegacyWpMediaUrl(resolveMediaUrl(b.logo?.url?.trim()));
                  return (
                    <div className="swiper-slide" key={b.id} suppressHydrationWarning>
                      <Link href={`/brands/${b.slug}`}>
                        {/* Logo tải trực tiếp — thiếu logo thì dùng placeholder dùng chung,
                            KHÔNG để vòng xoay swiper-lazy-preloader treo. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={logo ?? "/wp/logo-1.png"} className="swiper-lazy" alt={b.name} width={1} height={1} />
                      </Link>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== 10. Content bottom (SEO wyswyg) ===== */}
      {homeContentBottomMarkup ? (
        <div className="content-bottom wyswyg">
          <div
            className="container"
            dangerouslySetInnerHTML={{ __html: homeContentBottomMarkup }}
          />
        </div>
      ) : null}

      <HomeAnalytics />
    </>
  );
}
