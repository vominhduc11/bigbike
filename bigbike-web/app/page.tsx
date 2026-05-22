import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import type { Article, Category, HomeSlider, Product } from "@/lib/contracts/public";
import { HeroSlider } from "@/components/home/HeroSlider";
import { BrandCarousel } from "@/components/home/BrandCarousel";
import { FeaturedProductsCarousel } from "@/components/home/FeaturedProductsCarousel";
import { ProductCard } from "@/components/catalog/ProductCard";
import { ExperienceCarousel } from "@/components/home/ExperienceCarousel";
import { HomeVideoCarousel } from "@/components/home/HomeVideoCarousel";
import { HomeAnalytics } from "@/components/home/HomeAnalytics";
import {
  getProductBySlug,
  listArticles,
  listBrands,
  listCategories,
  listHomeSliders,
  listHomeVideos,
  listProducts,
  listPublicSettings,
} from "@/lib/api/public-api";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import {
  buildFaqPageJsonLd,
  buildLocalBusinessJsonLd,
  buildOrganizationJsonLd,
  buildWebSiteJsonLd,
  serializeJsonLd,
} from "@/lib/seo/json-ld";
import {
  formatDate,
  isSafeHomeVideoUrl,
  resolveMediaUrl,
  safeText,
  toSafePublicHref,
} from "@/lib/utils/format";
import { sanitizeRichHtml } from "@/lib/utils/html";
import {
  toArticlePath,
  toCategoryPath,
  toHomePath,
  toProductListPath,
} from "@/lib/utils/routes";

// Locale is read from a cookie (next-intl) — opt into dynamic rendering.
// Data fetches are still cached at the fetch cache level.
export const dynamic = "force-dynamic";

const HOME_ORG_LOGO = "/wp/logo.png";

const HOME_FAQS = [
  {
    question: "BigBike có ship hàng toàn quốc không?",
    answer:
      "Có. BigBike giao hàng toàn quốc qua các đơn vị vận chuyển uy tín. Miễn phí ship cho đơn hàng từ 2 triệu đồng.",
  },
  {
    question: "Sản phẩm tại BigBike có chính hãng không?",
    answer:
      "100% sản phẩm tại BigBike là hàng chính hãng, có nguồn gốc rõ ràng và được bảo hành theo chính sách của từng thương hiệu.",
  },
  {
    question: "Tôi có thể đổi trả hàng tại BigBike không?",
    answer:
      "BigBike hỗ trợ đổi trả trong vòng 7 ngày với sản phẩm còn nguyên vẹn, chưa qua sử dụng và còn nguyên tem mác.",
  },
  {
    question: "BigBike tư vấn chọn mũ bảo hiểm như thế nào?",
    answer:
      "Đội ngũ BigBike tư vấn theo xe, cung đường và nhu cầu thực tế. Bạn có thể liên hệ qua Zalo hoặc hotline để được hỗ trợ chọn size và dòng phù hợp.",
  },
];

export async function generateMetadata(): Promise<Metadata> {
  const settingsResult = await listPublicSettings();
  const settings = settingsResult.data ?? [];
  const title =
    findSetting(settings, "seo_home_title") ||
    "Shop đồ bảo hộ, đồ phượt moto chuyên cung cấp các phụ kiện đi phượt";
  const description =
    findSetting(settings, "seo_home_description") ||
    "Bigbike là shop bảo hộ phượt moto uy tín tại TP HCM. Cửa hàng chuyên cung cấp các sản phẩm đồ bảo hộ và phụ kiện chất lượng chính hãng.";
  const ogImage = findSetting(settings, "og_image_url").trim() || undefined;

  return {
    ...buildPublicMetadata({ title, description, canonicalPath: toHomePath(), ogImage }),
    title: { absolute: title },
  };
}

function findSetting(
  settings: Array<{ settingKey: string; settingValue: string }>,
  key: string,
): string {
  return settings.find((s) => s.settingKey === key)?.settingValue ?? "";
}

/**
 * Slug sản phẩm gắn với banner. Backend trả productLink dạng `/sp/<slug>.html`
 * (dự phòng thêm dạng `/san-pham/<slug>`).
 */
function sliderProductSlug(slider: HomeSlider): string | null {
  const link = slider.productLink?.trim() ?? "";
  const match = link.match(/\/sp\/(.+?)\.html$/) ?? link.match(/\/san-pham\/([^/?#]+)/);
  return match ? match[1] : null;
}

function toHeroSlide(slider: HomeSlider, product: Product | null) {
  const desktopSrc = resolveMediaUrl(slider.desktopImage?.url?.trim());
  if (!desktopSrc) return null;
  const mobileSrc = resolveMediaUrl(slider.mobileImage?.url?.trim()) || desktopSrc;
  return {
    id: slider.id,
    desktopSrc,
    mobileSrc,
    href: toSafePublicHref(
      slider.link || slider.productLink || slider.externalLink,
      toProductListPath(),
    ),
    alt: safeText(slider.desktopImage?.alt || slider.mobileImage?.alt, "BigBike"),
    productName: product ? safeText(product.name, "") : "",
    categoryName: product?.category?.name ?? "",
    productCode: product?.sku?.trim() ?? "",
  };
}

function isRenderableHomeVideo(video: import("@/lib/contracts/public").HomeVideo): boolean {
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
          width={90}
          height={90}
          sizes="90px"
          className="bb-cat-list-icon"
        />
      </span>
      <span className="bb-cat-list-desc">{name}</span>
      <svg
        className="bb-cat-list-arrow"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="11" />
        <path d="M10 7l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
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

function WpNewsCard({ article }: { article: Article }) {
  const title = safeText(article.title, "Bài viết");
  const excerpt = resolveWpNewsExcerpt(article);
  const src = resolveMediaUrl(article.coverImage?.url?.trim());
  const dateStr = formatDate(article.publishedAt ?? article.createdAt);

  return (
    <Link href={toArticlePath(article.slug)} className="bb-news-card">
      <div className="bb-news-img-wrap">
        {src ? (
          <Image
            src={src}
            alt={safeText(article.coverImage?.alt, title)}
            fill
            className="bb-news-img"
            sizes="(max-width: 575px) calc(100vw - 30px), (max-width: 767px) 50vw, 370px"
          />
        ) : (
          <div className="bb-news-img-placeholder" aria-hidden="true">
            <span className="bb-news-img-placeholder-mark">BIGBIKE</span>
          </div>
        )}
      </div>
      <div className="bb-news-body">
        <span className="bb-news-date" aria-hidden="true">
          {dateStr}
        </span>
        <div className="bb-news-body-inside">
          <h3 className="bb-news-card-title">{title}</h3>
          {excerpt && <p className="bb-news-excerpt">{excerpt}</p>}
        </div>
      </div>
    </Link>
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
    featuredProductsResult,
    carouselProductsResult,
    homeVideosResult,
  ] = await Promise.all([
    listHomeSliders(),
    listCategories({ page: 1, size: 100, sort: "sortOrder:asc", showOnHomepage: true }),
    listArticles({ page: 1, category: "reviews", size: 3, sort: "publishedAt:desc" }),
    listArticles({ page: 1, category: "tin-tuc", size: 3, sort: "publishedAt:desc" }),
    listBrands({ page: 1, size: 12, sort: "name:asc" }),
    listPublicSettings(),
    listProducts({ page: 1, homepageBlock: "FEATURED_GRID", size: 3, sort: "homepageOrder:asc", lang: locale }),
    listProducts({ page: 1, homepageBlock: "RECOMMENDED_CAROUSEL", size: 10, sort: "homepageOrder:asc", lang: locale }),
    listHomeVideos(),
  ]);

  // Each product lives in exactly one homepage block (enum FEATURED_GRID | RECOMMENDED_CAROUSEL | NONE),
  // so the prior dedupe pass is no longer required.
  const featuredProducts = featuredProductsResult.data;
  const carouselProducts = carouselProductsResult.data;

  const settings = settingsResult.data ?? [];
  const hotline = findSetting(settings, "hotline") || findSetting(settings, "phone");
  const promoTitle = findSetting(settings, "promo_title") || "LS2 DUAL SPORT MX436\nPIONEER";
  const promoOff = findSetting(settings, "promo_off") || "20% OFF";
  const promoHref = findSetting(settings, "promo_href") || toProductListPath();
  const promoImageSrc =
    resolveMediaUrl(findSetting(settings, "promo_image_url").trim()) || "/wp/banner-ads.jpg";
  const aboutTitle = findSetting(settings, "about_title").trim();
  const aboutSubtitle = findSetting(settings, "about_subtitle").trim();
  const aboutContentHtml = findSetting(settings, "about_content_html").trim();
  const hasSettingsAbout = Boolean(aboutTitle && aboutSubtitle && aboutContentHtml);
  const homeContentBottomHtml = findSetting(settings, "home_content_bottom_html").trim();
  const homeH1 =
    findSetting(settings, "seo_home_h1").trim() ||
    findSetting(settings, "seo_home_title").trim() ||
    "BigBike — Shop đồ bảo hộ moto, phụ kiện touring chính hãng";
  const expSubtitle =
    findSetting(settings, "home_exp_subtitle").trim() || "GÓC TRẢI NGHIỆM CÙNG BIGBIKE";
  const expTitle =
    findSetting(settings, "home_exp_title").trim() || "PHỤ KIỆN ĐI PHƯỢT MOTO CAO CẤP";
  const expDesc =
    findSetting(settings, "home_exp_desc").trim() ||
    "Tại shop bán đồ phượt moto Bigbike, các sản phẩm đồ bảo hộ moto và phụ kiện phượt rất đa dạng về mẫu mã và kiểu dáng với giá cả vô cùng phải chăng. Ngoài ra, đội ngũ nhân viên của cửa hàng rất am hiểu sản phẩm, sẵn sàng tư vấn và chăm sóc khách hàng khi cần thiết.";
  const address = findSetting(settings, "address");

  // Mỗi banner có thể gắn 1 sản phẩm — tải sản phẩm đó để hiện tên/danh mục lên hero.
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

  const expArticles = expArticlesResult.data;
  const newsArticles = newsArticlesResult.data;
  // WordPress homepage renders the five latest videos in this carousel.
  const HOME_VIDEO_LIMIT = 5;
  const homeVideos = (homeVideosResult.data ?? [])
    .filter(isRenderableHomeVideo)
    .slice(0, HOME_VIDEO_LIMIT);

  const jsonLdOrg = serializeJsonLd(buildOrganizationJsonLd("BigBike", HOME_ORG_LOGO));
  const jsonLdWeb = serializeJsonLd(buildWebSiteJsonLd("BigBike"));
  const jsonLdLocalBusiness = serializeJsonLd(
    buildLocalBusinessJsonLd("BigBike", HOME_ORG_LOGO, address, hotline),
  );
  const jsonLdFaq = serializeJsonLd(buildFaqPageJsonLd(HOME_FAQS));

  return (
    <div className="bb-home">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdOrg }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdWeb }} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdLocalBusiness }}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdFaq }} />

      {/* Block 1: Hero Banner — WP page-home.php main-banner swiper */}
      {/* H1 ở đây là sr-only cho SEO — WP không có tagline strip */}
      <h1 className="sr-only">{homeH1}</h1>
      <HeroSlider slides={slides} />

      <div className="bb-container">
        {/* Block 2: Featured Products (ISR) */}
        {featuredProducts.length > 0 && (
          <section aria-label="Sản phẩm nổi bật">
            <div className="grid grid-cols-3 gap-[30px] pt-[40px] pb-[40px] max-[900px]:grid-cols-2 max-[600px]:grid-cols-1">
              {featuredProducts.slice(0, 3).map((p) => (
                <ProductCard key={p.id} product={p} variant="tile" />
              ))}
            </div>
          </section>
        )}

        {/* Block 3: About BigBike */}
        <section className="bb-about" aria-labelledby="home-about-heading">
          <div className="bb-about-inner">
            <div className="bb-about-mark" aria-hidden="true">
              <Image src={HOME_ORG_LOGO} alt="" width={260} height={160} />
            </div>
            <div className="bb-about-text">
              {hasSettingsAbout ? (
                <>
                  <p className="bb-kicker">{aboutSubtitle}</p>
                  <h2 id="home-about-heading" className="bb-about-title">
                    {aboutTitle}
                  </h2>
                  <div
                    className="bb-about-richtext"
                    dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(aboutContentHtml) }}
                  />
                </>
              ) : (
                <>
                  <p className="bb-kicker">Về BigBike · Est. 2013</p>
                  <h2 id="home-about-heading" className="bb-about-title">
                    Gear bảo hộ chính hãng cho rider biết mình cần gì
                  </h2>
                  <p>
                    BigBike là shop chuyên đồ phượt, đồ bảo hộ moto và phụ kiện touring tại TP
                    HCM, tập trung vào sản phẩm chính hãng, thông tin rõ ràng và tư vấn kỹ trước
                    khi khách xuống tiền.
                  </p>
                  <p>
                    Tinh thần của shop: nhìn nhanh biết món nào đáng tin, so sánh dễ, chọn đúng
                    size, đúng nhu cầu — và luôn có người hỗ trợ khi cần.
                  </p>
                  <div className="bb-about-stats">
                    <div className="bb-about-stat">
                      <b>Từ 2013</b>
                      <span>Năm thành lập</span>
                    </div>
                    <div className="bb-about-stat">
                      <b>100%</b>
                      <span>Hàng chính hãng</span>
                    </div>
                    <div className="bb-about-stat">
                      <b>Toàn quốc</b>
                      <span>Giao hàng</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Block 4: Product Carousel (ISR) — admin-curated picks */}
      {carouselProducts.length > 0 && (
        <section className="bb-products-section bb-home-products-parity" aria-labelledby="home-products-heading">
          <div className="bb-container">
            <div className="bb-products-header">
              <p className="bb-kicker">SẢN PHẨM NỔI BẬT</p>
              <h2 id="home-products-heading" className="bb-products-title bb-section-title">
                SẢN PHẨM NỔI BẬT TẠI BIGBIKE
              </h2>
            </div>
            <FeaturedProductsCarousel products={carouselProducts} />
            {categoriesResult.data.length > 0 && (
              <div className="bb-cat-list mb-[10px]" aria-label="Danh mục sản phẩm">
                {categoriesResult.data.map((cat) => (
                  <WpCategoryListItem key={cat.id} category={cat} />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Block 5: Category Grid (standalone) — chỉ render khi KHÔNG có carousel sản phẩm để vẫn cho user thấy danh mục */}
      {carouselProducts.length === 0 && categoriesResult.data.length > 0 && (
        <section className="bb-products-section" aria-label="Danh mục sản phẩm">
          <div className="bb-container">
            <div className="bb-cat-list">
              {categoriesResult.data.map((cat) => (
                <WpCategoryListItem key={cat.id} category={cat} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Block 6: Promo Banner */}
      {promoImageSrc ? (
        <div className="pt-[60px]">
          <Link
            href={promoHref}
            className="bb-promo-banner bb-promo-banner-image block no-underline"
            aria-label="Khuyến mãi BigBike"
          >
            <div className="bb-container bb-promo-image-container">
              <Image
                src={promoImageSrc}
                alt="Banner khuyến mãi BigBike"
                fill
                className="bb-promo-image"
                sizes="(max-width: 768px) 100vw, 1440px"
              />
            </div>
          </Link>
        </div>
      ) : (
        <Link
          href={promoHref}
          className="bb-promo-banner block no-underline"
        >
          <div className="bb-container">
            <div className="bb-promo-content">
              <p className="bb-promo-subtitle">HOT OFFER</p>
              <h2 className="bb-promo-title">
                {promoTitle.split("\n").map((line, i) => (
                  <span key={i} className="block">
                    {line}
                  </span>
                ))}{" "}
                <span className="bb-promo-off">{promoOff}</span>
              </h2>
            </div>
            <span className="bb-promo-bg-text" aria-hidden="true">
              BIGBIKE
            </span>
          </div>
        </Link>
      )}

      {/* Block 7: Experience Section */}
      {expArticles.length > 0 && (
        <section className="bb-experience !pb-0 !pt-[100px]" aria-labelledby="home-exp-heading">
          <div className="mx-auto w-full max-w-[1200px] px-[15px]">
            <div className="bb-experience-header !pb-[40px] text-center">
              <p className="bb-experience-kicker !mb-[10px] !text-[16px] !leading-[19px]">
                {expSubtitle}
              </p>
              <h2 id="home-exp-heading" className="bb-experience-title !m-0 !text-[35px] !leading-[60px] max-[767px]:!text-24 max-[767px]:!leading-[30px]">
                {expTitle}
              </h2>
              <div className="mx-auto w-full pt-[30px] md:w-2/3 min-[1200px]:max-w-[770px]">
                <p className="bb-experience-desc !m-0 !max-w-none !text-base !leading-6 !text-black">
                  {expDesc}
                </p>
              </div>
            </div>
          </div>
          <ExperienceCarousel articles={expArticles} />
        </section>
      )}

      {/* Block 8: News Section */}
      {newsArticles.length > 0 && (
        <section
          className="bb-news-section bb-news-section--home"
          aria-labelledby="home-news-heading"
        >
          <div className="bb-container">
            <div className="bb-news-block-title text-center">
              <p className="bb-news-kicker">TIN TỨC MỚI UPDATE</p>
              <h2 id="home-news-heading" className="bb-news-heading">
                CẬP NHẬT XU HƯỚNG CÙNG BIGBIKE
              </h2>
            </div>
            <div className="bb-articles-grid-v2">
              {newsArticles.map((article) => (
                <WpNewsCard key={article.id} article={article} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Block 9: Home Video Carousel */}
      {homeVideos.length > 0 && (
        <section className="relative bg-background pt-[80px]" aria-labelledby="home-video-heading">
          <div
            className="relative bg-[url('/wp/video-bg.jpg')] bg-cover bg-center bg-no-repeat pb-[90px]"
          >
            <div className="relative z-[1] mx-auto w-full max-w-[1200px] px-[15px]">
              <div className="pt-[90px] pb-[70px] text-center text-white max-[575px]:pt-12 max-[575px]:pb-10">
                <h2
                  id="home-video-heading"
                  className="m-0 font-display text-[35px] font-semibold uppercase leading-[60px] tracking-normal text-white max-[991px]:text-32 max-[991px]:leading-[1.35] max-[575px]:text-26 max-[575px]:leading-[1.25]"
                >
                  TRẢI NGHIỆM SẢN PHẨM CÙNG BIGBIKE.VN
                </h2>
              </div>
              <HomeVideoCarousel videos={homeVideos} />
            </div>
          </div>
        </section>
      )}

      {/* Block 10: Brand Carousel */}
      {brandsResult.data.length > 0 && (
        <section className="bb-brands-section pt-[120px] pb-[120px]" aria-label="Thương hiệu đối tác">
          <BrandCarousel brands={brandsResult.data} />
        </section>
      )}

      {/* Block 11: SEO Content */}
      <section className="bb-seo-content" aria-labelledby="home-seo-heading">
        <div className="bb-container">
          {homeContentBottomHtml ? (
            <div
              className="bb-seo-content-body"
              dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(homeContentBottomHtml) }}
            />
          ) : (
            <div className="bb-seo-content-body">
              <div className="mb-8 max-[600px]:mb-6">
                <p className="bb-kicker">VỀ BIGBIKE</p>
                <h2 id="home-seo-heading" className="bb-section-title">
                  SHOP BÁN ĐỒ BẢO HỘ MOTO — PHỤ KIỆN TOURING CHÍNH HÃNG TẠI TP HCM
                </h2>
              </div>
              <p>
                BigBike chuyên cung cấp đồ bảo hộ moto, phụ kiện touring và gear chính hãng
                cho biker tại TP HCM.
              </p>
              <ul>
                <li>
                  <Link href={toCategoryPath("non-bao-hiem-moto")}>Mũ bảo hiểm</Link> chính hãng.
                </li>
                <li>
                  <Link href={toCategoryPath("quan-ao-bao-ho-moto")}>Áo giáp moto</Link> và quần áo bảo hộ.
                </li>
                <li>
                  <Link href={toCategoryPath("gang-tay")}>Găng tay</Link> cho nhiều nhu cầu chạy xe.
                </li>
                <li>
                  <Link href={toCategoryPath("giay-bao-ho")}>Giày moto</Link> và boot bảo hộ.
                </li>
                <li>
                  <Link href={toProductListPath()}>Phụ kiện touring</Link> cho hành trình dài.
                </li>
              </ul>
            </div>
          )}
        </div>
      </section>

      {/* Analytics (CSR, no render) */}
      <HomeAnalytics />
    </div>
  );
}
