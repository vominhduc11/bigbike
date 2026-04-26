import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import type { Article, Category, HomeSlider, Product } from "@/lib/contracts/public";
import { HeroSlider } from "@/components/home/HeroSlider";
import { FloatingChat } from "@/components/home/FloatingChat";
import { FeaturedProductsCarousel } from "@/components/home/FeaturedProductsCarousel";
import { BrandCarousel } from "@/components/home/BrandCarousel";
import {
  listArticles,
  listBrands,
  listCategories,
  listHomeSliders,
  listProducts,
  listPublicSettings,
} from "@/lib/api/public-api";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { buildLocalBusinessJsonLd, buildOrganizationJsonLd, buildWebSiteJsonLd, serializeJsonLd } from "@/lib/seo/json-ld";
import { formatDate, resolveMediaUrl, safeText } from "@/lib/utils/format";
import { sanitizeRichHtml } from "@/lib/utils/html";
import {
  toArticleListPath,
  toArticlePath,
  toCategoryPath,
  toHomePath,
  toProductListPath,
  toProductPath,
} from "@/lib/utils/routes";

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

const HOME_ORG_LOGO = "/brand/logo/PNG/01/BIGBIKE_FINAL_LOGO-01.png";

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
    href: slider.link || slider.productLink || slider.externalLink || toProductListPath(),
    alt: safeText(slider.desktopImage?.alt || slider.mobileImage?.alt, "BigBike"),
  };
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

/* ── Block 2: 3 Featured Product Tiles ─────────────────── */
function WpProductTile3({ product }: { product: Product }) {
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
            unoptimized
            sizes="(max-width: 600px) 100vw, 33vw"
          />
        </div>
      )}
    </Link>
  );
}

/* ── Block 5: Category Image Cell ──────────────────────── */
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
          unoptimized
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

/* ── Block 7: Experience Slide ──────────────────────────── */
function WpExperienceSlide({ article }: { article: Article }) {
  const title = safeText(article.title, "Bài viết");
  const src = resolveMediaUrl(article.coverImage?.url?.trim());

  return (
    <Link href={toArticlePath(article.slug)} className="wp-experience-img-wrap">
      {src ? (
        <Image
          src={src}
          alt={safeText(article.coverImage?.alt, title)}
          fill
          className="wp-exp-bg"
          unoptimized
          sizes="33vw"
        />
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(135deg, #c00, #8b0000)",
          }}
        />
      )}
      <div className="wp-exp-overlay" />
      <div className="wp-exp-content">
        <p className="wp-exp-title">{title}</p>
        <span className="wp-exp-cta">XEM CHI TIẾT</span>
      </div>
    </Link>
  );
}

/* ── Block 8: News Card ─────────────────────────────────── */
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
            unoptimized
            sizes="(max-width: 600px) 100vw, 33vw"
          />
        ) : (
          <div style={{ width: "100%", height: "100%", background: "var(--bb-bg-surface-raised)" }} />
        )}
        <span className="wp-news-date">{dateStr}</span>
      </div>
      <div className="wp-news-body">
        <h3 className="wp-news-card-title">{title}</h3>
        {article.excerpt && (
          <p className="wp-news-excerpt">{article.excerpt}</p>
        )}
      </div>
    </Link>
  );
}

/* ── Homepage ───────────────────────────────────────────── */
export default async function HomePage() {
  const [
    slidersResult,
    featuredProductsResult,
    productsResult,
    categoriesResult,
    expArticlesResult,
    newsArticlesResult,
    brandsResult,
    settingsResult,
  ] =
    await Promise.all([
      listHomeSliders(),
      listProducts({ page: 1, filterFeatured: true, size: 3, sort: "sortOrder:asc" }),
      listProducts({ page: 1, size: 5, sort: "createdAt:desc" }),
      listCategories({ page: 1, size: 200, sort: "sortOrder:desc" }),
      listArticles({ page: 1, category: "trai-nghiem", size: 3, sort: "publishedAt:desc" }),
      listArticles({ page: 1, category: "blog", size: 3, sort: "publishedAt:desc" }),
      listBrands({ page: 1, size: 12, sort: "name:asc" }),
      listPublicSettings(),
    ]);

  const settings = settingsResult.data ?? [];
  const zaloUrl = findSetting(settings, "zalo_url") || findSetting(settings, "zalo");
  const hotline = findSetting(settings, "hotline") || findSetting(settings, "phone");
  const promoTitle =
    findSetting(settings, "promo_title") || "LS2 DUAL SPORT MX436\nPIONEER";
  const promoOff = findSetting(settings, "promo_off") || "20% OFF";
  const promoHref = findSetting(settings, "promo_href") || toProductListPath();
  const promoImageSrc = resolveMediaUrl(findSetting(settings, "promo_image_url").trim()) || "/banner-ads.jpg";
  const aboutTitle = findSetting(settings, "about_title").trim();
  const aboutSubtitle = findSetting(settings, "about_subtitle").trim();
  const aboutContentHtml = findSetting(settings, "about_content_html").trim();
  const hasSettingsAbout = Boolean(aboutTitle && aboutSubtitle && aboutContentHtml);
  const homeContentBottomHtml = findSetting(settings, "home_content_bottom_html").trim();
  const chatHref = zaloUrl || (hotline ? `tel:${hotline}` : null);

  /* ── Hero Slider ─────────────────────────────────────── */
  const slides = (slidersResult.data ?? [])
    .map(toHeroSlide)
    .filter((s): s is NonNullable<typeof s> => s !== null);

  /* ── Data slices ─────────────────────────────────────── */
  const featuredTiles = featuredProductsResult.data;
  const carouselProducts = productsResult.data.slice(0, 5);
  const expArticles = expArticlesResult.data;
  const newsArticles = newsArticlesResult.data;

  const address = findSetting(settings, "address");
  const jsonLdOrg = serializeJsonLd(buildOrganizationJsonLd("BigBike", HOME_ORG_LOGO));
  const jsonLdWeb = serializeJsonLd(buildWebSiteJsonLd("BigBike"));
  const jsonLdLocalBusiness = serializeJsonLd(
    buildLocalBusinessJsonLd("BigBike", HOME_ORG_LOGO, address, hotline),
  );

  return (
    <div className="wp-home">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdOrg }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdWeb }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdLocalBusiness }} />

      {/* ─────────────────────────────────────────────────────
          Block 1: Hero Banner (Swiper-style slider)
      ───────────────────────────────────────────────────── */}
      <HeroSlider slides={slides} />
      <HomeTrustRail />

      <div className="bb-container">
        {/* ─────────────────────────────────────────────────
            Block 2: 3 Sản phẩm nổi bật
            (gray bg, image bottom-right, category red, "Mua ngay")
        ───────────────────────────────────────────────── */}
        {featuredTiles.length > 0 && (
          <section aria-label="Sản phẩm nổi bật">
            <div className="wp-featured-grid-3">
              {featuredTiles.map((p) => (
                <WpProductTile3 key={p.id} product={p} />
              ))}
            </div>
          </section>
        )}

        {/* ─────────────────────────────────────────────────
            Block 3: About BigBike
        ───────────────────────────────────────────────── */}
        <section className="wp-about" aria-labelledby="home-about-heading">
          <div className="wp-about-inner">
            <div className="wp-about-mark" aria-hidden="true">
              <Image
                src={HOME_ORG_LOGO}
                alt=""
                width={260}
                height={160}
                unoptimized
              />
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
                    BigBike là shop chuyên đồ phượt, đồ bảo hộ moto và phụ kiện touring
                    tại TP HCM, tập trung vào sản phẩm chính hãng, thông tin rõ ràng và
                    tư vấn kỹ trước khi khách xuống tiền.
                  </p>
                  <p>
                    Tinh thần của website là gọn như một garage gear cao cấp: nhìn nhanh
                    biết món nào đáng tin, so sánh dễ, chọn đúng size, đúng nhu cầu và có
                    người hỗ trợ khi cần.
                  </p>
                  <div className="wp-about-stats">
                    <div className="wp-about-stat">
                      <b>13+</b>
                      <span>Năm đồng hành</span>
                    </div>
                    <div className="wp-about-stat">
                      <b>20K+</b>
                      <span>Khách hàng</span>
                    </div>
                    <div className="wp-about-stat">
                      <b>50+</b>
                      <span>Thương hiệu</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* ───────────────────────────────────────────────────
          Block 4: Sản phẩm nổi bật tại BigBike
          (product carousel – 5 cards, sale ribbon, stars, hover CTA)
      ───────────────────────────────────────────────────── */}
      {carouselProducts.length > 0 && (
        <section className="wp-products-section" aria-labelledby="home-products-heading">
          <div className="bb-container">
            <div className="wp-products-header">
              <div>
                <p className="wp-kicker">SẢN PHẨM NỔI BẬT</p>
                <h2 id="home-products-heading" className="wp-products-title">
                  SẢN PHẨM NỔI BẬT TẠI BIGBIKE
                </h2>
              </div>
              <Link href={toProductListPath()} className="wp-view-all-link">
                Xem tất cả →
              </Link>
            </div>
            <FeaturedProductsCarousel products={carouselProducts} />
          </div>
        </section>
      )}

      {/* ───────────────────────────────────────────────────
          Block 5: Grid danh mục sản phẩm
          (4 col desktop, 2 col mobile, image bg, hover red overlay + arrow)
      ───────────────────────────────────────────────────── */}
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

      {/* ───────────────────────────────────────────────────
          Block 6: Banner quảng cáo ngang (HOT OFFER)
      ───────────────────────────────────────────────────── */}
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
              unoptimized
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

      {/* ───────────────────────────────────────────────────
          Block 7: Góc trải nghiệm cùng BigBike
          (3 articles as big image slides with title + CTA overlay)
      ───────────────────────────────────────────────────── */}
      {expArticles.length > 0 && (
        <section className="wp-experience" aria-labelledby="home-exp-heading">
        <div className="bb-container">
          <div className="wp-experience-header">
            <p className="wp-kicker">GÓC TRẢI NGHIỆM CÙNG BIGBIKE</p>
            <h2 id="home-exp-heading" className="wp-experience-title">
              PHỤ KIỆN ĐI PHƯỢT MOTO CAO CẤP
            </h2>
            <p className="wp-experience-desc">
              Tại shop bán đồ phượt moto Bigbike, các sản phẩm đồ bảo hộ moto và phụ kiện
              phượt rất đa dạng về mẫu mã và kiểu dáng với giá cả vô cùng phải chăng. Ngoài
              ra, đội ngũ nhân viên của cửa hàng rất am hiểu sản phẩm, sẵn sàng tư vấn và
              chăm sóc khách hàng khi cần thiết.
            </p>
          </div>
        </div>

          <div className="wp-experience-images">
            {expArticles.map((a) => (
              <WpExperienceSlide key={a.id} article={a} />
            ))}
          </div>
        </section>
      )}

      {/* ───────────────────────────────────────────────────
          Block 8: Tin tức mới update
          (3-col blog cards with red diagonal date badge, shadow)
      ───────────────────────────────────────────────────── */}
      {newsArticles.length > 0 && (
        <section className="wp-news-section" aria-labelledby="home-news-heading">
          <div className="bb-container">
            <div className="wp-news-header">
              <div>
                <p className="wp-kicker">TIN TỨC MỚI UPDATE</p>
                <h2 id="home-news-heading" className="wp-news-title">
                  CẬP NHẬT XU HƯỚNG CÙNG BIGBIKE
                </h2>
              </div>
              <Link href={toArticleListPath()} className="wp-view-all-link">
                Xem tất cả →
              </Link>
            </div>
            <div className="wp-articles-grid-v2">
              {newsArticles.map((article) => (
                <WpNewsCard key={article.id} article={article} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ───────────────────────────────────────────────────
          Block 9: Brand / partner carousel
          (logo slider, muted → full opacity on hover)
      ───────────────────────────────────────────────────── */}
      {brandsResult.data.length > 0 && (
        <section className="wp-brands-section" aria-label="Thương hiệu đối tác">
          <div className="bb-container">
            <p className="wp-kicker">THƯƠNG HIỆU ĐỐI TÁC</p>
          </div>
          <BrandCarousel brands={brandsResult.data} />
        </section>
      )}

      {/* ───────────────────────────────────────────────────
          Block 10: Nội dung SEO cuối trang
          (gray bg, H1, paragraphs, internal links)
      ───────────────────────────────────────────────────── */}
      <div className="wp-seo-content">
        <div className="bb-container">
          {homeContentBottomHtml ? (
            <div
              dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(homeContentBottomHtml) }}
            />
          ) : (
            <>
              <h1>Shop bán đồ phượt moto chuyên cung cấp phụ kiện phượt moto</h1>
              <p>
                Bigbike chuyên cung cấp đồ bảo hộ moto, phụ kiện phượt và gear touring
                chính hãng cho anh em biker tại TP HCM.
              </p>
              <ul>
                <li>
                  <Link href="/mu-bao-hiem.html">Mũ bảo hiểm</Link> chính hãng.
                </li>
                <li>
                  <Link href="/ao-quan-bao-ho.html">Áo giáp moto</Link> và quần áo bảo hộ.
                </li>
                <li>
                  <Link href="/gang-tay.html">Găng tay phượt</Link> cho nhiều nhu cầu chạy xe.
                </li>
                <li>
                  <Link href="/giay-bao-ho.html">Giày moto</Link> và boot bảo hộ.
                </li>
                <li>
                  <Link href="/phu-kien-khac.html">Phụ kiện phượt</Link> cho hành trình dài.
                </li>
              </ul>
            </>
          )}
        </div>
      </div>

      {/* ── Floating Chat (Zalo / hotline) ─────────────── */}
      {chatHref && <FloatingChat href={chatHref} isExternal={!!zaloUrl} />}
    </div>
  );
}
