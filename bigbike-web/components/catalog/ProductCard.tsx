import Link from "next/link";
import type { Product } from "@/lib/contracts/public";
import { safeText } from "@/lib/utils/format";
import { toProductPath } from "@/lib/utils/routes";
import { MediaImage } from "@/components/ui/MediaImage";
import { PriceText } from "@/components/ui/PriceText";

type ProductCardProps = {
  product: Product;
};

export function ProductCard({ product }: ProductCardProps) {
  const name = safeText(product.name, "San pham dang cap nhat");
  const categoryName = safeText(product.category?.name, "Danh muc");
  const brandName = safeText(product.brand?.name, "BigBike");
  const stockLabel = mapStockState(product.stockState);

  return (
    <article className="bb-product-card bb-card bb-card-hover">
      <Link href={toProductPath(product.slug)} className="bb-product-card-link">
        <div className="bb-product-image-wrap">
          <MediaImage
            image={product.image}
            altFallback={name}
            className="bb-product-image"
            width={560}
            height={560}
          />
        </div>

        <div className="bb-product-body">
          <p className="bb-product-meta">
            {brandName} · {categoryName}
          </p>
          <h3 className="bb-product-title">{name}</h3>
          <PriceText price={product.price} />
          <p className={`bb-stock-badge ${stockLabel.className}`}>{stockLabel.label}</p>
        </div>
      </Link>
    </article>
  );
}

function mapStockState(state: Product["stockState"]) {
  switch (state) {
    case "IN_STOCK":
      return { label: "Con hang", className: "bb-stock-in" };
    case "LOW_STOCK":
      return { label: "Sap het hang", className: "bb-stock-low" };
    case "OUT_OF_STOCK":
      return { label: "Het hang", className: "bb-stock-out" };
    case "PREORDER":
      return { label: "Dat truoc", className: "bb-stock-preorder" };
    case "CONTACT_FOR_STOCK":
      return { label: "Lien he ton kho", className: "bb-stock-contact" };
    default:
      return { label: "Dang cap nhat", className: "bb-stock-out" };
  }
}

