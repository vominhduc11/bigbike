import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import type { Article, Category, HomeSlider } from "@/lib/contracts/public";
import { HeroSlider } from "@/components/home/HeroSlider";
import { BrandCarousel } from "@/components/home/BrandCarousel";
import { FeaturedProductsCarousel } from "@/components/home/FeaturedProductsCarousel";
import { ExperienceCarousel } from "@/components/home/ExperienceCarousel";
import { HomeVideoCarousel } from "@/components/home/HomeVideoCarousel";
import { HomeAnalytics } from "@/components/home/HomeAnalytics";
import {
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
  toArticleListPath,
  toArticlePath,
  toCategoryPath,
  toHomePath,
  toProductListPath,
  toProductPath,
} from "@/lib/utils/routes";

export const revalidate = 3600;

const HOME_ORG_LOGO = "/brand/logo/PNG/01/BIGBIKE_FINAL_LOGO-01.png";

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

function toHeroSlide(slider: HomeSlider) {
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
  };
}

function isRenderableHomeVideo(video: import("@/lib/contracts/public").HomeVideo): boolean {
  if (video.youtubeId && /^[A-Za-z0-9_-]{11}$/.test(video.youtubeId)) {
    return true;
  }
  return isSafeHomeVideoUrl(video.videoUrl);
}

function HomeTrustRail() {
  const items = [
    {
      title: "100% Chính hãng",
      sub: "Gear có nguồn gốc rõ, bảo hành theo hãng, cam kết chính hãng.",
      icon: "/brand/icons/SVG/DO/BIGBIKE_ICON-17.svg",
    },
    {
      title: "Giao hàng toàn quốc",
      sub: "Ship nhanh toàn quốc, miễn phí từ 2 triệu, đóng gói chắc chắn.",
      icon: "/brand/icons/SVG/DO/BIGBIKE_ICON-19.svg",
    },
    {
      title: "Tư vấn kỹ — đáng tin",
      sub: "Chọn mũ, áo giáp, găng tay theo xe, cung đường và nhu cầu thực.",
      icon: "/brand/icons/SVG/DO/BIGBIKE_ICON-21.svg",
    },
  ];

  return (
    <section className="wp-feature-row" aria-label="Cam kết BigBike">
      {items.map((item) => (
        <div className="wp-feature-tile" key={item.title}>
          <span className="wp-feat-icon" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.icon} alt="" width="52" height="52" />
          </span>
          <span className="wp-feat-text">
            <b>{item.title}</b>
            <span>{item.sub}</span>
          </span>
        </div>
      ))}
    </section>
  );
}

function WpCategoryImageCell({ category }: { category: Category }) {
  const name = safeText(category.name, "Danh mục");
  const imgAsset = category.image ?? category.icon;
  const src = imgAsset?.url ? resolveMediaUrl(imgAsset.url.trim()) : null;

  return (
    <Link href={toCategoryPath(category.slug)} className="wp-cat-img-cell">
      {src ? (
        <Image
          src={src}
          alt={safeText(imgAsset?.alt, name)}
          fill
          className="wp-cat-img-cell-bg"
          sizes="(max-width: 600px) 50vw, 25vw"
        />
      ) : (
        <div className="wp-cat-img-fallback">
          <span className="wp-cat-img-fallback-text">{name}</span>
        </div>
      )}
      <div className="wp-cat-img-overlay" />
      <div className="wp-cat-img-label">
        <span>{name}</span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M2.5 7h9M7 2.5l4.5 4.5-4.5 4.5" />
        </svg>
      </div>
    </Link>
  );
}

function WpNewsCard({ article }: { article: Article }) {
  const title = safeText(article.title, "Bài viết");
  const src = resolveMediaUrl(article.coverImage?.url?.trim());
  const dateStr = formatDate(article.publishedAt ?? article.createdAt);

  return (
    <Link href={toArticlePath(article.slug)} className="wp-news-card">
      <div className="wp-news-img-wrap">
        {src ? (
          <Image
            src={src}
            alt={safeText(article.coverImage?.alt, title)}
            fill
            className="wp-news-img"
            sizes="(max-width: 600px) 100vw, 33vw"
          />
        ) : (
          <div className="wp-news-img-placeholder" aria-hidden="true">
            <span className="wp-news-img-placeholder-mark">BIGBIKE</span>
          </div>
        )}
      </div>
      <div className="wp-news-body">
        <span className="wp-news-date" aria-hidden="true">
          {dateStr}
        </span>
        <div className="wp-news-body-inside">
          <h3 className="wp-news-card-title">{title}</h3>
          {article.excerpt && <p className="wp-news-excerpt">{article.excerpt}</p>}
        </div>
      </div>
    </Link>
  );
}

function FeaturedProductTile({ product }: { product: import("@/lib/contracts/public").Product }) {
  const name = safeText(product.name, "Sản phẩm");
  const href = toProductPath(product.slug);
  const src = resolveMediaUrl(product.image?.url?.trim());
  const categoryName = product.category?.name ?? "";

  return (
    <Link href={href} className="wp-tile-3">
      <div style={{ position: "relative", zIndex: 1 }}>
        {categoryName && <p className="wp-tile-3-cat">{categoryName}</p>}
        <h3 className="wp-tile-3-name">{name}</h3>
        <span className="wp-tile-3-cta">Mua ngay</span>
      </div>
      {src && (
        <div className="wp-tile-3-img-wrap">
          <Image
            src={src}
            alt={safeText(product.image?.alt, name)}
            fill
            className="wp-tile-3-img"
            sizes="(max-width: 600px) 100vw, 33vw"
          />
        </div>
      )}
    </Link>
  );
}

export default async function HomePage() {
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
    listArticles({ page: 1, category: "trai-nghiem", size: 3, sort: "publishedAt:desc" }),
    listArticles({ page: 1, category: "blog", size: 3, sort: "publishedAt:desc" }),
    listBrands({ page: 1, size: 12, sort: "name:asc" }),
    listPublicSettings(),
    listProducts({ page: 1, filterFeatured: true, size: 12, sort: "createdAt:desc" }),
    listProducts({ page: 1, size: 5, sort: "createdAt:desc" }),
    listHomeVideos(),
  ]);

  const settings = settingsResult.data ?? [];
  const hotline = findSetting(settings, "hotline") || findSetting(settings, "phone");
  const promoTitle = findSetting(settings, "promo_title") || "LS2 DUAL SPORT MX436\nPIONEER";
  const promoOff = findSetting(settings, "promo_off") || "20% OFF";
  const promoHref = findSetting(settings, "promo_href") || toProductListPath();
  const promoImageSrc =
    resolveMediaUrl(findSetting(settings, "promo_image_url").trim()) || "/banner-ads.jpg";
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

  const slides = (slidersResult.data ?? [])
    .map(toHeroSlide)
    .filter((s): s is NonNullable<typeof s> => s !== null);

  const expArticles = expArticlesResult.data;
  const newsArticles = newsArticlesResult.data;
  const homeVideos = (homeVideosResult.data ?? []).filter(isRenderableHomeVideo);

  const jsonLdOrg = serializeJsonLd(buildOrganizationJsonLd("BigBike", HOME_ORG_LOGO));
  const jsonLdWeb = serializeJsonLd(buildWebSiteJsonLd("BigBike"));
  const jsonLdLocalBusiness = serializeJsonLd(
    buildLocalBusinessJsonLd("BigBike", HOME_ORG_LOGO, address, hotline),
  );
  const jsonLdFaq = serializeJsonLd(buildFaqPageJsonLd(HOME_FAQS));

  return (
    <div className="wp-home">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdOrg }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdWeb }} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdLocalBusiness }}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdFaq }} />

      {/* Block 1: Hero Banner */}
      <h1 className="bb-sr-only">{homeH1}</h1>
      <HeroSlider slides={slides} />
      <HomeTrustRail />

      <div className="bb-container">
        {/* Block 2: Featured Products (ISR) */}
        {featuredProductsResult.data.length > 0 && (
          <section aria-label="Sản phẩm nổi bật">
            <div className="wp-featured-grid-3">
              {featuredProductsResult.data.map((p) => (
                <FeaturedProductTile key={p.id} product={p} />
              ))}
            </div>
          </section>
        )}

        {/* Block 3: About BigBike */}
        <section className="wp-about" aria-labelledby="home-about-heading">
          <div className="wp-about-inner">
            <div className="wp-about-mark" aria-hidden="true">
              <Image src={HOME_ORG_LOGO} alt="" width={260} height={160} />
            </div>
            <div className="wp-about-text">
              {hasSettingsAbout ? (
                <>
                  <p className="wp-kicker">{aboutSubtitle}</p>
                  <h2 id="home-about-heading" className="wp-about-title">
                    {aboutTitle}
                  </h2>
                  <div
                    className="wp-about-richtext"
                    dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(aboutContentHtml) }}
                  />
                </>
              ) : (
                <>
                  <p className="wp-kicker">Về BigBike · Est. 2013</p>
                  <h2 id="home-about-heading" className="wp-about-title">
                    Garage đồ chơi cao cấp cho rider biết mình cần gì
                  </h2>
                  <p>
                    BigBike là shop chuyên đồ phượt, đồ bảo hộ moto và phụ kiện touring tại TP
                    HCM, tập trung vào sản phẩm chính hãng, thông tin rõ ràng và tư vấn kỹ trước
                    khi khách xuống tiền.
                  </p>
                  <p>
                    Tinh thần của website là gọn như một garage gear cao cấp: nhìn nhanh biết món
                    nào đáng tin, so sánh dễ, chọn đúng size, đúng nhu cầu và có người hỗ trợ khi
                    cần.
                  </p>
                  <div className="wp-about-stats">
                    <div className="wp-about-stat">
                      <b>Từ 2013</b>
                      <span>Năm thành lập</span>
                    </div>
                    <div className="wp-about-stat">
                      <b>100%</b>
                      <span>Hàng chính hãng</span>
                    </div>
                    <div className="wp-about-stat">
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

      {/* Block 4: Product Carousel (ISR) */}
      {carouselProductsResult.data.length > 0 && (
        <section className="wp-products-section" aria-labelledby="home-products-heading">
          <div className="bb-container">
            <div className="wp-products-header">
              <div>
                <p className="wp-kicker">MỚI NHẤT</p>
                <h2 id="home-products-heading" className="wp-products-title">
                  SẢN PHẨM MỚI TẠI BIGBIKE
                </h2>
              </div>
              <Link href={toProductListPath()} className="wp-view-all-link">
                Xem tất cả →
              </Link>
            </div>
            <FeaturedProductsCarousel products={carouselProductsResult.data} />
          </div>
        </section>
      )}

      {/* Block 5: Category Grid */}
      {categoriesResult.data.length > 0 && (
        <section className="wp-cat-section" aria-labelledby="home-cat-heading">
          <div className="bb-container">
            <div className="wp-cat-section-header">
              <div>
                <p className="wp-kicker">DANH MỤC SẢN PHẨM</p>
                <h2 id="home-cat-heading" className="wp-cat-section-title">
                  KHÁM PHÁ DANH MỤC
                </h2>
              </div>
              <Link href={toProductListPath()} className="wp-view-all-link">
                Xem tất cả →
              </Link>
            </div>
          </div>
          <div className="wp-cat-grid-img">
            {categoriesResult.data.map((cat) => (
              <WpCategoryImageCell key={cat.id} category={cat} />
            ))}
          </div>
        </section>
      )}

      {/* Block 6: Promo Banner */}
      {promoImageSrc ? (
        <Link
          href={promoHref}
          className="wp-promo-banner wp-promo-banner-image"
          style={{ display: "block", textDecoration: "none" }}
          aria-label="Khuyến mãi BigBike"
        >
          <div className="bb-container wp-promo-image-container">
            <Image
              src={promoImageSrc}
              alt="Banner khuyến mãi BigBike"
              fill
              className="wp-promo-image"
              sizes="(max-width: 768px) 100vw, 1440px"
            />
          </div>
        </Link>
      ) : (
        <Link
          href={promoHref}
          className="wp-promo-banner"
          style={{ display: "block", textDecoration: "none" }}
        >
          <div className="bb-container">
            <div className="wp-promo-content">
              <p className="wp-promo-subtitle">HOT OFFER</p>
              <h2 className="wp-promo-title">
                {promoTitle.split("\n").map((line, i) => (
                  <span key={i} style={{ display: "block" }}>
                    {line}
                  </span>
                ))}{" "}
                <span className="wp-promo-off">{promoOff}</span>
              </h2>
            </div>
            <span className="wp-promo-bg-text" aria-hidden="true">
              BIGBIKE
            </span>
          </div>
        </Link>
      )}

      {/* Block 7: Experience Section */}
      {expArticles.length > 0 && (
        <section className="wp-experience" aria-labelledby="home-exp-heading">
          <div className="bb-container">
            <div className="wp-experience-header">
              <p className="wp-kicker">{expSubtitle}</p>
              <h2 id="home-exp-heading" className="wp-experience-title">
                {expTitle}
              </h2>
              <p className="wp-experience-desc">{expDesc}</p>
            </div>
          </div>
          <ExperienceCarousel articles={expArticles} />
        </section>
      )}

      {/* Block 8: News Section */}
      {newsArticles.length > 0 && (
        <section
          className="wp-news-section wp-news-section--home"
          aria-labelledby="home-news-heading"
        >
          <div className="bb-container">
            <div className="wp-news-block-title">
              <p className="wp-news-kicker">TIN TỨC MỚI UPDATE</p>
              <h2 id="home-news-heading" className="wp-news-heading">
                CẬP NHẬT XU HƯỚNG CÙNG BIGBIKE
              </h2>
            </div>
            <div className="wp-articles-grid-v2">
              {newsArticles.map((article) => (
                <WpNewsCard key={article.id} article={article} />
              ))}
            </div>
            <div className="wp-news-cta-row">
              <Link href={toArticleListPath()} className="wp-news-cta-btn">
                XEM TẤT CẢ TIN TỨC
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Block 9: Home Video Carousel */}
      {homeVideos.length > 0 && (
        <section className="wp-video-section" aria-labelledby="home-video-heading">
          <div className="wp-video-section-inner">
            <div className="bb-container">
              <div className="wp-video-section-header">
                <h2 id="home-video-heading" className="wp-video-section-title">
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
        <section className="wp-brands-section" aria-label="Thương hiệu đối tác">
          <div className="bb-container">
            <p className="wp-kicker">THƯƠNG HIỆU ĐỐI TÁC</p>
          </div>
          <BrandCarousel brands={brandsResult.data} />
        </section>
      )}

      {/* Block 10: SEO Content */}
      <div className="wp-seo-content">
        <div className="bb-container">
          {homeContentBottomHtml ? (
            <div
              dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(homeContentBottomHtml) }}
            />
          ) : (
            <>
              <h2>Shop bán đồ bảo hộ moto — phụ kiện touring chính hãng tại TP HCM</h2>
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
            </>
          )}
        </div>
      </div>

      {/* Analytics (CSR, no render) */}
      <HomeAnalytics />
    </div>
  );
}
