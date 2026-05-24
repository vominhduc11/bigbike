import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import type { Article, Category, HomeSlider, HomeVideo, Product } from "@/lib/contracts/public";
import { HeroSlider } from "@/components/home/HeroSlider";
import { BrandCarousel } from "@/components/home/BrandCarousel";
import { FeaturedProductsCarousel } from "@/components/home/FeaturedProductsCarousel";
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
  isSafeHomeVideoUrl,
  resolveMediaUrl,
  safeText,
  toSafePublicHref,
} from "@/lib/utils/format";
import { toArticlePath, toCategoryPath, toHomePath, toProductListPath } from "@/lib/utils/routes";

// Locale is read from a cookie (next-intl) — opt into dynamic rendering.
// Data fetches are still cached at the fetch cache level.
export const dynamic = "force-dynamic";

const HOME_ORG_LOGO = "/wp/logo.png";

const WP_ABOUT_HTML =
  '<p><span style="font-weight: 400">Bigbike tự hào là một trong những shop chuyên bán đồ phượt, đồ bảo hộ moto đáng tin cậy tại TP HCM được nhiều anh em biker tin tưởng lựa chọn. Chúng tôi chuyên cung cấp đa dạng các dòng sản phẩm đồ phượt moto, phụ kiện phượt, đồ bảo hộ chính hãng từ nhiều thương hiệu nổi tiếng trên thế giới.</span></p>';

const WP_CONTENT_BOTTOM_HTML = `<h1 style="text-align: justify"><strong>Shop bán đồ phượt moto chuyên cung cấp phụ kiện phượt moto</strong></h1><p style="text-align: justify"><span style="font-weight: 400">Các sản phẩm <strong>đồ bảo hộ moto</strong> và <strong>phụ kiện phượt</strong> là những vật dụng không thể thiếu cho các tay chơi phân khối lớn. Các sản phẩm này có chức năng chính là bảo vệ sự an toàn cho các biker khi điều khiển xe moto với tốc độ cao trong các cuộc hành trình khám phá.</span></p><p style="text-align: justify"><span style="font-weight: 400">Có rất nhiều loại đồ bảo hộ moto, mỗi sản phẩm đều sở hữu một tính năng bảo vệ riêng, có thể kể đến như:</span></p><ul style="text-align: justify"><li style="font-weight: 400"><span style="font-weight: 400">Mũ bảo hiểm: giúp giảm thiểu tối đa chấn thương vùng đầu.</span></li><li style="font-weight: 400"><span style="font-weight: 400">Áo quần bảo hộ: bảo vệ cơ thể người mặc khỏi những va đập khi di chuyển.</span></li><li style="font-weight: 400"><span style="font-weight: 400">Găng tay bảo hộ: hạn chế tổn thương vùng tay.</span></li><li style="font-weight: 400"><span style="font-weight: 400">Giày bảo hộ: tăng khả năng bảo vệ chân khỏi nguy hiểm.</span></li><li style="font-weight: 400"><span style="font-weight: 400">Giáp bảo hộ tay chân – đai lưng – phụ kiện giáp: hỗ trợ tăng khả năng chống va đập, mài mòn và nâng cao khả năng bảo vệ người mặc trong những tình huống bất ngờ.</span></li></ul><p style="text-align: justify"><span style="font-weight: 400">Bên cạnh đó, các biker hiện nay thường có xu hướng trang bị thêm cho mình nhiều phụ kiện đi phượt moto khác để nâng cao khả năng bảo vệ cho cơ thể. Có nhiều loại sản phẩm đang được các biker ưa chuộng như phụ kiện đi mưa, pinlock và khẩu trang.</span></p><p style="text-align: justify"><span style="font-weight: 400">Ngoài ra, những sản phẩm đồ bảo hộ và phụ kiện đi phượt moto còn góp phần làm nổi bật phong cách và đồng thời thể hiện sự mạnh mẽ cho người sử dụng. </span></p><h2 style="text-align: justify"><strong>Shop bảo hộ moto đáng tin cậy của các biker</strong></h2><p style="text-align: justify"><span style="font-weight: 400">Đến với shop bán đồ phượt moto Bigbike, khách hàng được hoàn toàn đảm bảo về chất lượng sản phẩm. Các sản phẩm luôn đạt được các tiêu chuẩn về độ an toàn dành cho các thiết bị bảo hộ, nên bạn có thể yên tâm khi sử dụng. </span></p><p style="text-align: justify"><span style="font-weight: 400">Các sản phẩm </span><a href="https://bigbike.vn/mu-bao-hiem.html"><span style="font-weight: 400">mũ bảo hiểm</span></a><span style="font-weight: 400">, </span><a href="https://bigbike.vn/ao-quan-bao-ho.html"><span style="font-weight: 400">quần – áo bảo hộ</span></a><span style="font-weight: 400">, </span><a href="https://bigbike.vn/gang-tay.html"><span style="font-weight: 400">găng tay</span></a><span style="font-weight: 400">, </span><a href="https://bigbike.vn/giay-bao-ho.html"><span style="font-weight: 400">giày bảo hộ moto</span></a><span style="font-weight: 400"> và </span><a href="https://bigbike.vn/phu-kien-khac.html"><span style="font-weight: 400">các phụ kiện đi phượt moto khác</span></a><span style="font-weight: 400"> được cung cấp bởi những thương hiệu nổi tiếng như </span><span style="font-weight: 400">Alpinestars, Scoyco và Furygan, </span><span style="font-weight: 400">rất đa dạng về mẫu mã, kích cỡ và màu sắc cho khách hàng nhiều sự lựa chọn khác nhau. Bên cạnh sự cam kết về chất lượng, chúng tôi còn đảm bảo về mức giá tốt nhất cho khách hàng. </span></p><p style="text-align: justify"><span style="font-weight: 400">Những xu hướng và mẫu mã thịnh hành nhất trên thị trường hiện nay luôn được shop đồbảo hộ moto của chúng tôi cập nhật thường xuyên. Nhằm</span> <span style="font-weight: 400">đáp ứng kịp thời thị hiếu và nhu cầu từ cơ bản đến nâng cao của khách hàng. Khi đến trực tiếp shop đồ phượt moto của Bigbike, bạn sẽ được nhân viên tư vấn thông tin chi tiết và có thể kiểm tra chất lượng trực tiếp để lựa chọn cho mình sản phẩm phù hợp.</span></p><p style="text-align: justify"><span style="font-weight: 400">Bigbike luôn lắng nghe, thấu hiểu những ý kiến đóng góp của khách hàng và cố gắng hoàn thiện mình để đem đến cho bạn những sản phẩm và dịch vụ tốt nhất và cố gắng trở thành shop đồ phượt Hồ Chí Minh được các anh em biker tin tưởng. Trong suốt quá trình hình thành và phát triển, chúng tôi tự hào là đơn vị nhận được sự tin tưởng cũng như những đánh giá tích cực từ cộng đồng biker. </span></p><p style="text-align: justify"><span style="font-weight: 400">Đội ngũ nhân viên của shop đồ phượt moto Bigbike có sự am hiểu về kiến thức, thông tin sản phẩm và luôn sẵn sàng tư vấn khi cần thiết. Sự hài lòng của khách hàng luôn là tiêu chí hàng đầu của chúng tôi. </span></p><p style="text-align: justify"><span style="font-weight: 400">Những chính sách hậu mãi và dịch vụ hậu cần cũng luôn được thực hiện nhanh chóng. Các hoạt động giao nhận hàng hóa, các chính sách bảo hành và đổi trả sản phẩm luôn được áp dụng tiện lợi nhất. Hàng hóa khi được vận chuyển luôn đảm bảo trạng thái tốt nhất khi đến tay của khách hàng. </span></p><p style="text-align: justify"><span style="font-weight: 400">Chúng tôi cung cấp đầy đủ những gì bạn cần cho một cuộc hành trình. Bigbike là shop bảo hộ moto uy tín và xứng đáng để bạn trao gửi niềm tin. Hãy </span><a href="https://bigbike.vn/vi/lien-he.html"><span style="font-weight: 400">liên hệ</span></a>  <span style="font-weight: 400">ngay với bộ phận tư vấn chúng tôi để biết thêm thông tin chi tiết về các sản phẩm và để được nhận các chương trình ưu đãi hấp dẫn.</span></p>`;

function toLegacyWpMediaUrl(src: string | null | undefined): string | null {
  if (!src) return null;
  return src.startsWith("/wp-content/") ? `https://bigbike.vn${src}` : src;
}

const HOME_CATEGORY_HIGHLIGHTS = [
  {
    category: "BALÔ ĐEO LƯNG - TÚI ĐEO - TÚI TREO XE",
    categoryHref: "/balo-deo-lung-tui-deo-tui-treo-xe.html",
    title: "BALO MOTO PHƯỢT TAICHI RSB278 – CHỐNG NƯỚC",
    href: "/sp/balo-moto-phuot-chinh-hang-taichi-rs278-chong-nuoc.html",
    imageSrc:
      "https://bigbike.vn/wp-content/uploads/2023/03/Balo-di-mo-to-phuot-chinh-hang-Taichi-RSB278-chong-mua-3-300x300.jpg",
  },
  {
    category: "MŨ BẢO HIỂM",
    categoryHref: "/mu-bao-hiem.html",
    title: "MŨ BẢO HIỂM LS2 FF800 STORM II ECE22.06",
    href: "/sp/mu-bao-hiem-ls2-ff800-storm.html",
    imageSrc:
      "https://bigbike.vn/wp-content/uploads/2020/07/MU-BAO-HIEM-LS2-FF800-TITANIUM-17-300x300.jpg",
  },
];


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
    alt: safeText(slider.desktopImage?.alt || slider.mobileImage?.alt, "BigBike"),
    productName: product ? safeText(product.name, "") : "",
    categoryName: product?.category?.name ?? "",
    productCode: product?.sku?.trim() || "BIGBIKE",
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
          width={90}
          height={90}
          sizes="90px"
          className="bb-cat-list-icon"
        />
      </span>
      <span className="bb-cat-list-desc">{name}</span>
    </Link>
  );
}

function HomeCategoryHighlights() {
  return (
    <div className="category-list">
      <div className="container">
        <div className="row">
          {HOME_CATEGORY_HIGHLIGHTS.map((item) => (
            <div key={item.href} className="col-md-4">
              <div className="item">
                <div className="item--thumbnail">
                  <Link href={item.href}>
                    <img
                      src={item.imageSrc}
                      alt={item.title}
                      className="-swiper-lazy lazy"
                      loading="lazy"
                    />
                  </Link>
                </div>
                <Link className="item--category" href={item.categoryHref}>
                  {item.category}
                </Link>
                <h3 className="item--title">
                  <Link href={item.href}>{item.title}</Link>
                </h3>
                <Link className="item--btn" href={item.href}>
                  Mua ngay <i className="fal fa-chevron-right" aria-hidden="true" />
                </Link>
              </div>
            </div>
          ))}
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
  ] = await Promise.all([
    listHomeSliders(),
    listCategories({ page: 1, size: 100, sort: "sortOrder:asc", showOnHomepage: true }),
    listArticles({ page: 1, category: "reviews", size: 3, sort: "publishedAt:desc" }),
    listArticles({ page: 1, category: "tin-tuc", size: 3, sort: "publishedAt:desc" }),
    listBrands({ page: 1, size: 12, sort: "name:asc" }),
    listPublicSettings(),
    listProducts({
      page: 1,
      homepageBlock: "RECOMMENDED_CAROUSEL",
      size: 10,
      sort: "homepageOrder:asc",
      lang: locale,
    }),
    listHomeVideos(),
  ]);

  const carouselProducts = carouselProductsResult.data;
  const settings = settingsResult.data ?? [];
  const hotline = findSetting(settings, "hotline") || findSetting(settings, "phone");
  const address = findSetting(settings, "address");
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
  const homeVideos = (homeVideosResult.data ?? [])
    .filter(isRenderableHomeVideo)
    .slice(0, 5);

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

      <h1 className="sr-only">{homeH1}</h1>
      <HeroSlider slides={slides} />

      <HomeCategoryHighlights />

      <div className="about-bigbike">
        <div className="container">
          <div className="block-title text-center mb-40">
            <p className="sub-title">BIGBIKE</p>
            <h3>SHOP BẢO HỘ MOTO UY TÍN</h3>
          </div>
          <div
            className="block-content text-center"
            dangerouslySetInnerHTML={{ __html: WP_ABOUT_HTML }}
          />
        </div>
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

      <div className="banner-ads pt-60">
        <div className="container">
          <div className="row">
            <div className="col-md-12">
              <a href="#">
                <img src="/wp/banner-ads.jpg" alt="" className="lazy" loading="lazy" suppressHydrationWarning />
              </a>
            </div>
          </div>
        </div>
      </div>

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

      {newsArticles.length > 0 && (
        <div className="news pt-60">
          <div className="container">
            <div className="block-title text-center pb-40">
              <p className="sub-title">TIN TỨC MỚI UPDATE</p>
              <h3>CẬP NHẬT XU HƯỚNG CÙNG BIGBIKE</h3>
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

      {brandsResult.data.length > 0 && (
        <div className="partner-slide pt-120 pb-120">
          <BrandCarousel brands={brandsResult.data} />
        </div>
      )}

      <div className="content-bottom wyswyg">
        <div
          className="container"
          dangerouslySetInnerHTML={{ __html: WP_CONTENT_BOTTOM_HTML }}
        />
      </div>

      <HomeAnalytics />
    </div>
  );
}
