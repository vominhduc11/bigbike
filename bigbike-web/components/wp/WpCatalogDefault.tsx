import { Fragment, type ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import type { Brand, CatalogFacets, Category, Product } from "@/lib/contracts/public";
import { DEFAULT_WP_ORDERBY, type WpOrderbyValue } from "@/lib/utils/catalog-sort";
import { WpCategoryPagination } from "./WpCategoryPagination";
import { WpCategorySidebar } from "./WpCategorySidebar";
import { WpCategorySort } from "./WpCategorySort";
import { WpProductGridItem } from "./WpProductGridItem";

type CatalogPagination = {
  page: number;
  totalPages: number;
  totalItems?: number | null;
};

type WpCatalogDefaultProps = {
  canonicalPath: string;
  brands: Brand[];
  categories: Category[];
  facets?: CatalogFacets | null;
  beforeGridHtml?: string | null;
  beforeGridNode?: ReactNode;
  products?: Product[];
  pagination?: CatalogPagination | null;
};

export async function WpCatalogDefault({
  canonicalPath,
  brands,
  categories,
  facets = null,
  beforeGridHtml = null,
  beforeGridNode,
  products = [],
  pagination = null,
}: WpCatalogDefaultProps) {
  const [t, tProduct] = await Promise.all([
    getTranslations("Catalog"),
    getTranslations("Product"),
  ]);
  const orderbyCurrent: WpOrderbyValue = DEFAULT_WP_ORDERBY;
  const notice = products.length === 0 ? t("noResults") : null;

  return (
    <div className="row pb-40">
      <div className="col-md-3">
        <WpCategorySidebar
          brands={brands}
          categories={categories}
          facets={facets}
          current={{}}
          resetHref={canonicalPath}
          hiddenParams={{}}
        />
      </div>

      <div className="col-md-9">
        <div className="product-list pb-40">
          <div className="container">
            <div className="product-list-filter headroom" style={{ position: "sticky", top: "80px", zIndex: 20 }}>
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
                <div className="col-sm-6 filter-mobile-wrapper">
                  <div className="filter-mobile" aria-hidden="true">
                    <p>
                      {t("filterMobileHeading")} <i className="far fa-sliders-v" aria-hidden="true" />
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="product-count" />
            <div className="product">
              {beforeGridNode != null ? <Fragment key="before-grid">{beforeGridNode}</Fragment> : null}
              {beforeGridNode == null && beforeGridHtml ? (
                <div className="desc" dangerouslySetInnerHTML={{ __html: beforeGridHtml }} />
              ) : null}
              {notice ? (
                <p className="woocommerce-info">{notice}</p>
              ) : (
                <div className="relative">
                  <div className="row">
                    {products.map((product) => (
                      <WpProductGridItem key={product.id} product={product} selectLabel={tProduct("cardSelect")} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        {pagination ? (
          <WpCategoryPagination page={pagination.page} totalPages={pagination.totalPages} baseHref={canonicalPath} />
        ) : null}
      </div>
    </div>
  );
}
