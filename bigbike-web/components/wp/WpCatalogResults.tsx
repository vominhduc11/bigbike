import { Fragment, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import type { Product } from "@/lib/contracts/public";
import type { WpOrderbyValue } from "@/lib/utils/catalog-sort";
import { cn } from "@/lib/utils";
import { ProductCardSkel } from "@/components/ui/skeleton/primitives";
import { WpCategorySort } from "./WpCategorySort";
import { WpMobileFilterTrigger } from "./WpMobileFilterTrigger";
import { WpCategoryPagination } from "./WpCategoryPagination";
import { WpProductSwipeItem } from "./WpProductSwipeItem";

type CatalogPagination = {
  page: number;
  totalPages: number;
  totalItems?: number | null;
};

export type WpCatalogResultsProps = {
  orderbyCurrent: WpOrderbyValue;
  pagination?: CatalogPagination | null;
  products: Product[];
  /** Khi khác null: hiển thị thông báo (lỗi/empty/validation) thay cho lưới sản phẩm. */
  notice?: string | null;
  /** Nội dung phụ ngay trên lưới (vd: mô tả danh mục). Luôn render kể cả khi có notice. */
  beforeGrid?: ReactNode;
  paginationBaseHref: string;
  /** Lưới CSR đang tải lần đầu (chưa có data) → hiện skeleton thay vì notice. */
  isLoading?: boolean;
  /** Đã có data (cũ) hiển thị nhưng đang fetch bản mới (đổi filter/sort/trang) → làm mờ lưới + báo hiệu, không im lặng. */
  isRefetching?: boolean;
};

/**
 * Cột kết quả (`.col-md-9`) dùng chung cho 4 trang archive sản phẩm: toolbar
 * (đếm số + sort + nút lọc mobile) + lưới sản phẩm + phân trang. Port DOM 1:1 từ
 * woocommerce/archive-product.php, gom khối vốn copy y hệt ở /san-pham,
 * /tim-kiem, /danh-muc-san-pham/[slug] và /brands/[slug].
 */
export function WpCatalogResults({
  orderbyCurrent,
  pagination,
  products,
  notice = null,
  beforeGrid,
  paginationBaseHref,
  isLoading = false,
  isRefetching = false,
}: WpCatalogResultsProps) {
  const t = useTranslations("Catalog");
  return (
    <div className="col-md-9">
      <div className="product-list pb-40">
        <div className="container">
          {/* Sticky topSpacing 80 — render thẳng inline (trước đây jquery.sticky của
              home.min.js gán; nay ở markup để khớp hydration, không mutate DOM). */}
          <div
            className="product-list-filter headroom"
            style={{ position: "sticky", top: "80px", zIndex: 20 }}
          >
            <div className="row align-items-center">
              <div className="woocommerce-notices-wrapper" />
              <div className="col-sm-6">
                <div className="result woocommerce-result-count">
                  {pagination?.totalItems != null ? t("productCountLabel", { count: pagination.totalItems }) : null}
                </div>
              </div>
              <div className="col-sm-6 text-right">
                <WpCategorySort current={orderbyCurrent} />
              </div>
              <WpMobileFilterTrigger />
            </div>
          </div>
          <div className="product-count" />
          <div className="product">
            {/* beforeGrid là element được TẠO ở trang cha (vd LHtml mô tả danh mục) rồi
                truyền xuống qua prop. Khi nằm cạnh khối lưới/notice trong cùng parent, React
                coi nó là phần tử trong "list" nhưng tối ưu static-children chỉ phủ element tạo
                tại chỗ → cảnh báo thiếu key. Bọc trong Fragment có key để nó là CON DUY NHẤT
                của wrapper (không còn là thành viên mảng nhiều con) — không đổi DOM/giao diện. */}
            {beforeGrid != null ? <Fragment key="before-grid">{beforeGrid}</Fragment> : null}
            {isLoading ? (
              <div className="row">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div className="col-md-3 col-6" key={i}>
                    <ProductCardSkel />
                  </div>
                ))}
              </div>
            ) : notice != null ? (
              <p className="woocommerce-info">{notice}</p>
            ) : (
              <div className="relative">
                <div
                  className={cn("row transition-opacity duration-200", isRefetching && "opacity-50")}
                  aria-busy={isRefetching || undefined}
                >
                  {products.map((product) => (
                    <WpProductSwipeItem
                      key={product.id}
                      product={product}
                      wrapperClassName="col-md-3 col-6"
                    />
                  ))}
                </div>
                {isRefetching ? (
                  <div
                    className="pointer-events-none absolute inset-0 flex items-start justify-center pt-16"
                    role="status"
                  >
                    <Loader2 className="h-8 w-8 animate-spin text-brand" aria-hidden="true" />
                    <span className="sr-only">{t("updating")}</span>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>
      {pagination ? (
        <WpCategoryPagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          baseHref={paginationBaseHref}
        />
      ) : null}
    </div>
  );
}
