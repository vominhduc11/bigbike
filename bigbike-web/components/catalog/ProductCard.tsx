import Link from "next/link";
import type { Product } from "@/lib/contracts/public";
import { formatVnd, safeText } from "@/lib/utils/format";
import { toProductPath } from "@/lib/utils/routes";
import { MediaImage } from "@/components/ui/MediaImage";
import { ProductCardAddBar } from "@/components/catalog/ProductCardAddBar";
import { RatingStars } from "@/components/ui/RatingStars";

type ProductCardProps = {
  product: Product;
};

export function ProductCard({ product }: ProductCardProps) {
  const name = safeText(product.name, "Sản phẩm đang cập nhật");
  const brandName = safeText(product.brand?.name, "BigBike");
  const stockLabel = mapStockState(product.stockState);
  const retail = product.price?.retailPrice ?? 0;
  const sale =
    product.price?.salePrice && product.price.salePrice > 0
      ? product.price.salePrice
      : null;
  const compare =
    product.price?.compareAtPrice && product.price.compareAtPrice > 0
      ? product.price.compareAtPrice
      : null;
  const current = sale ?? retail;
  const isSale = Boolean(
    (sale && sale < retail) || (compare && compare > current),
  );

  return (
    <article className="wp-product-card">
      <Link
        href={toProductPath(product.slug)}
        className="wp-product-card-link"
        aria-label={`Xem ${name}`}
        tabIndex={0}
      />
      <div className="wp-product-image">
        {isSale && <span className="wp-product-tag">Sale</span>}
        <MediaImage
          image={product.image}
          altFallback={name}
          width={480}
          height={480}
        />
        <ProductCardAddBar
          productId={product.id}
          hasVariants={!!product.variants?.length}
          slug={product.slug}
        />
      </div>

      <div className="wp-product-body">
        <p className="wp-product-brand">{brandName}</p>
        <h3 className="wp-product-name">{name}</h3>
        {product.rating != null && product.rating > 0 && (
          <div className="wp-product-rating">
            <RatingStars value={product.rating} />
          </div>
        )}
        <div className="wp-product-price">
          {product.price ? (
            <>
              <b>{formatVnd(current)}</b>
              {compare && compare > current ? <s>{formatVnd(compare)}</s> : null}
            </>
          ) : (
            <b>Liên hệ</b>
          )}
        </div>
        <span className={`wp-stock-badge ${stockLabel.className}`}>
          {stockLabel.label}
        </span>
      </div>
    </article>
  );
}

function mapStockState(state: Product["stockState"]) {
  switch (state) {
    case "IN_STOCK":
      return { label: "Còn hàng", className: "wp-stock-in" };
    case "LOW_STOCK":
      return { label: "Sắp hết hàng", className: "wp-stock-low" };
    case "OUT_OF_STOCK":
      return { label: "Hết hàng", className: "wp-stock-out" };
    case "PREORDER":
      return { label: "Đặt trước", className: "wp-stock-preorder" };
    case "CONTACT_FOR_STOCK":
      return { label: "Liên hệ tồn kho", className: "wp-stock-out" };
    default:
      return { label: "Đang cập nhật", className: "wp-stock-out" };
  }
}
