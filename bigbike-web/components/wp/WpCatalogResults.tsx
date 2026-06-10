import type { ReactNode } from "react";
import type { Product } from "@/lib/contracts/public";
import type { WpOrderbyValue } from "@/lib/utils/catalog-sort";
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
}: WpCatalogResultsProps) {
  return (
    <div className="col-md-9">
      <div className="product-list pb-40">
        <div className="container">
          <div className="product-list-filter headroom">
            <div className="row align-items-center">
              <div className="woocommerce-notices-wrapper" />
              <div className="col-sm-6">
                <div className="result woocommerce-result-count">
                  {pagination?.totalItems != null ? `${pagination.totalItems} Sản phẩm` : null}
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
            {beforeGrid}
            {notice != null ? (
              <p className="woocommerce-info">{notice}</p>
            ) : (
              <div className="row">
                {products.map((product) => (
                  <WpProductSwipeItem
                    key={product.id}
                    product={product}
                    wrapperClassName="col-md-3 col-6"
                  />
                ))}
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
