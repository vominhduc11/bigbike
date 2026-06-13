import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { WpCategoryHero, type WpCategoryCrumb } from "@/components/wp/WpCategoryHero";
import { WpThemeStylesheet } from "@/components/wp/WpThemeStylesheet";
import { Tr } from "@/components/i18n/Tr";
import { listBrands } from "@/lib/api/public-api";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { toBrandListPath, toHomePath } from "@/lib/utils/routes";
import { WpBrandListClient } from "./WpBrandListClient";

// Shell + hero. Lưới thương hiệu view MẶC ĐỊNH (trang 1, sắp xếp tên A→Z) fetch sẵn ở
// server (revalidate theo tag "brands") và truyền xuống → nằm trong HTML server (SEO).
// Phân trang/đổi sắp xếp do client tiếp quản theo searchParams.
//
// size/sort phải khớp default của WpBrandListClient (DEFAULT_PAGE_SIZE=12, name:asc)
// để query key trùng → dùng đúng initialData, không lệch hydrate.
export async function generateMetadata(): Promise<Metadata> {
  return buildPublicMetadata({
    title: "Thương hiệu",
    description:
      "Khám phá tất cả thương hiệu đồ bảo hộ biker tại BigBike — mũ bảo hiểm, áo giáp, găng tay và phụ kiện rider chính hãng.",
    canonicalPath: toBrandListPath(),
  });
}

export default async function BrandListPage() {
  const locale = await getLocale();
  const brandsResult = await listBrands({ page: 1, size: 12, sort: "name:asc", lang: locale });

  const heroBreadcrumb: WpCategoryCrumb[] = [
    { label: "Bigbike.vn", href: toHomePath() },
    { label: "Thương hiệu", labelNode: <Tr ns="Catalog" k="brandsTitle" /> },
  ];

  return (
    <>
      <WpThemeStylesheet href="/wp-content/themes/bigbike/css/wp-theme-category.css?v=2" />

      <div className="archive tax-pwb-brand post-type-archive-product">
        <WpCategoryHero title="Thương hiệu" titleNode={<Tr ns="Catalog" k="brandsTitle" />} breadcrumb={heroBreadcrumb} />

        <div id="main-content">
          <div className="container">
            <div className="pwb-all-brands pt-40 pb-40">
              <WpBrandListClient
                initialBrands={brandsResult.data}
                initialPagination={brandsResult.pagination}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
