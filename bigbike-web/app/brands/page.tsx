import type { Metadata } from "next";
import { WpCategoryHero, type WpCategoryCrumb } from "@/components/wp/WpCategoryHero";
import { Tr } from "@/components/i18n/Tr";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { toBrandListPath, toHomePath } from "@/lib/utils/routes";
import { WpBrandListClient } from "./WpBrandListClient";

// Shell tĩnh (ISR) — hero. Lưới thương hiệu (phân trang/sắp xếp theo searchParams)
// render ở CLIENT qua WpBrandListClient → trang không SSR.
export async function generateMetadata(): Promise<Metadata> {
  return buildPublicMetadata({
    title: "Thương hiệu",
    description:
      "Khám phá tất cả thương hiệu đồ bảo hộ biker tại BigBike — mũ bảo hiểm, áo giáp, găng tay và phụ kiện rider chính hãng.",
    canonicalPath: toBrandListPath(),
  });
}

export default function BrandListPage() {
  const heroBreadcrumb: WpCategoryCrumb[] = [
    { label: "Bigbike.vn", href: toHomePath() },
    { label: "Thương hiệu", labelNode: <Tr ns="Catalog" k="brandsTitle" /> },
  ];

  return (
    <>
      <link
        rel="stylesheet"
        href="/wp-content/themes/bigbike/css/wp-theme-category.css?v=2"
        precedence="default"
      />

      <div className="archive tax-pwb-brand post-type-archive-product">
        <WpCategoryHero title="Thương hiệu" titleNode={<Tr ns="Catalog" k="brandsTitle" />} breadcrumb={heroBreadcrumb} />

        <div id="main-content">
          <div className="container">
            <div className="pwb-all-brands pt-40 pb-40">
              <WpBrandListClient />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
