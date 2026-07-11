import { Fragment, type ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { CatalogResults } from "@/components/catalog/CatalogResults";
import { CatalogSidebar } from "@/components/catalog/CatalogSidebar";
import type { Brand, CatalogFacets, Category, Product } from "@/lib/contracts/public";
import { DEFAULT_CATALOG_ORDERBY, type CatalogOrderbyValue } from "@/lib/utils/catalog-sort";

type CatalogPagination = {
  page: number;
  totalPages: number;
  totalItems?: number | null;
};

type CatalogDefaultProps = {
  canonicalPath: string;
  brands: Brand[];
  categories: Category[];
  facets?: CatalogFacets | null;
  beforeGridHtml?: string | null;
  beforeGridNode?: ReactNode;
  products?: Product[];
  pagination?: CatalogPagination | null;
};

export async function CatalogDefault({
  canonicalPath,
  brands,
  categories,
  facets = null,
  beforeGridHtml = null,
  beforeGridNode,
  products = [],
  pagination = null,
}: CatalogDefaultProps) {
  const t = await getTranslations("Catalog");
  const orderbyCurrent: CatalogOrderbyValue = DEFAULT_CATALOG_ORDERBY;
  const notice = products.length === 0 ? t("noResults") : null;

  return (
    <div className="grid gap-8 pb-10 md:grid-cols-[minmax(220px,1fr)_3fr]">
      <CatalogSidebar brands={brands} categories={categories} facets={facets} current={{}} resetHref={canonicalPath} hiddenParams={{}} />
      <CatalogResults
        orderbyCurrent={orderbyCurrent}
        pagination={pagination}
        products={products}
        notice={notice}
        beforeGrid={
          beforeGridNode != null
            ? <Fragment key="before-grid">{beforeGridNode}</Fragment>
            : beforeGridHtml
              ? <div className="mb-8 [&_p]:mb-4" dangerouslySetInnerHTML={{ __html: beforeGridHtml }} />
              : null
        }
        paginationBaseHref={canonicalPath}
      />
    </div>
  );
}
