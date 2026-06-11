import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { WpCategoryHero, type WpCategoryCrumb } from "@/components/wp/WpCategoryHero";
import { listContentCategories, listPublicSettings } from "@/lib/api/public-api";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { resolveMediaUrl, toLegacyWpMediaUrl } from "@/lib/utils/format";
import { readDefaultHeroAssets, readHeroSettings } from "@/lib/utils/page-hero";
import { toArticleListPath, toHomePath } from "@/lib/utils/routes";
import { WpArticleListClient } from "./WpArticleListClient";

// content_top / content_bottom — ACF của category "Tin tức" trên WP (backend
// content-categories không lưu field này nên giữ tĩnh, port 1:1 từ bigbike.vn).
const NEWS_CONTENT_TOP =
  "Bên cạnh việc mang đến khách hàng các sản phẩm phượt moto cao cấp chính hãng, " +
  "Bigbike mong muốn chia sẻ các thông tin chi tiết cũng như các bí quyết lựa chọn " +
  "quần áo bảo hộ, mũ bảo hiểm, găng tay, giày bảo hộ và các phụ kiện phượt moto khác " +
  "trên trang TIN TỨC của chúng tôi. Ngoài ra, các bài đánh giá và xếp hạng sản phẩm " +
  "bảo hộ phượt moto uy tín, chất lượng và các xu hướng mới nhất trên thị trường cũng " +
  "luôn được cập nhật thường xuyên.";
const NEWS_CONTENT_BOTTOM =
  "Qua những thông tin và các bài viết được chia sẻ, Bigbike hy vọng các anh em biker " +
  "sẽ cập nhật thêm nhiều thông tin bổ ích và có thể chọn lựa sản phẩm bảo hộ phượt moto " +
  "phù hợp cho mình. Tuy nhiên, các sản phẩm bảo hộ phượt moto là những mặt hàng đòi hỏi " +
  "người mua phải cân nhắc trên nhiều khía cạnh như kích cỡ, chất liệu và thiết kế. " +
  "Chính vì thế, Bigbike khuyên rằng khách hàng nên đến trực tiếp cửa hàng để được tư vấn, " +
  "hỗ trợ thêm về thông tin các sản phẩm và các dịch vụ tại Bigbike. " +
  "Xin chân thành cảm ơn sự tín nhiệm của khách hàng dành cho Bigbike!";

// Shell tĩnh (ISR) — hero (settings "hero_news") + danh mục tin tức (admin quản lý,
// revalidate tag "articles"/"settings"). Danh sách bài (lọc/tìm/phân trang theo
// searchParams) render ở CLIENT qua WpArticleListClient → trang không SSR.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Blog");
  return buildPublicMetadata({
    title: t("title"),
    description: t("metaDescription"),
    canonicalPath: toArticleListPath(),
  });
}

export default async function ArticleListPage() {
  const t = await getTranslations("Blog");
  const locale = await getLocale();

  const [settingsResult, categoriesResult] = await Promise.all([
    listPublicSettings(locale),
    listContentCategories(),
  ]);

  const heroSettings = readHeroSettings(settingsResult.data ?? [], "hero_news");
  const defaultHero = readDefaultHeroAssets(settingsResult.data ?? []);
  const heroTitle = heroSettings.title ?? "Tin tức";
  const heroBgUrl = toLegacyWpMediaUrl(
    resolveMediaUrl(heroSettings.imageUrl?.trim()) || defaultHero.defaultBgUrl?.trim(),
  );
  const heroIllustrationUrl = toLegacyWpMediaUrl(
    resolveMediaUrl(defaultHero.defaultIllustrationUrl?.trim()),
  );
  const heroBreadcrumb: WpCategoryCrumb[] = [
    { label: "Bigbike.vn", href: toHomePath() },
    { label: t("breadcrumb") },
  ];

  const sidebarCategories = categoriesResult.data.filter((cat) => cat.articleCount > 0);

  return (
    <>
      <link
        rel="stylesheet"
        href="/wp-content/themes/bigbike/css/wp-theme-news.css?v=4"
        precedence="default"
      />

      <div className="archive category">
        <WpCategoryHero
          title={heroTitle}
          breadcrumb={heroBreadcrumb}
          bgUrl={heroBgUrl}
          illustrationUrl={heroIllustrationUrl}
          illustrationAlt={heroSettings.imageAlt ?? heroTitle}
        />

        <div id="main-content">
          <div className="container">
            <WpArticleListClient
              categories={sidebarCategories}
              contentTop={NEWS_CONTENT_TOP}
              contentBottom={NEWS_CONTENT_BOTTOM}
            />
          </div>
        </div>
      </div>
    </>
  );
}
