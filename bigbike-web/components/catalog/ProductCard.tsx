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
  const name = safeText(product.name, "Sản phẩm đang cập nhật");
  const categoryName = safeText(product.category?.name, "Danh mục");
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
      return { label: "Còn hàng", className: "bb-stock-in" };
    case "LOW_STOCK":
      return { label: "Sắp hết hàng", className: "bb-stock-low" };
    case "OUT_OF_STOCK":
      return { label: "Hết hàng", className: "bb-stock-out" };
    case "PREORDER":
      return { label: "Đặt trước", className: "bb-stock-preorder" };
    case "CONTACT_FOR_STOCK":
      return { label: "Liên hệ tồn kho", className: "bb-stock-contact" };
    default:
      return { label: "Đang cập nhật", className: "bb-stock-out" };
  }
}

