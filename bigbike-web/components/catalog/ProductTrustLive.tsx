"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale } from "next-intl";
import type { Product, ProductPrice, ProductStockState } from "@/lib/contracts/public";
import { derivePricing } from "@/lib/pricing";
import { formatVnd } from "@/lib/utils/format";
import { Tr } from "@/components/i18n/Tr";

// Giá + tồn kho cho khối "Mua tại BigBike.vn" (#11). Trước đây khối này đọc giá/tồn TĨNH
// lúc dựng trang nên LỆCH với khu mua hàng chính (WpPurchaseSection): không tính giảm giá,
// không tính trạng thái "tắt bán thủ công" → có thể hiện "Còn hàng"/giá gốc trong khi nút
// mua đã "Hết hàng"/giá khuyến mãi. Ở đây dùng CHUNG nguồn thời gian thực: cùng queryKey
// ["product-snapshot", slug, locale] nên react-query chia sẻ cache, KHÔNG fetch thừa.

type Snapshot = {
  pricing: { retailPrice: number; compareAtPrice: number | null; salePrice: number | null; discountPercent: number; currency: string };
  stock: { stockState: string; label: string; forceOutOfStock: boolean; quantity?: number | null };
  variants: unknown[];
};

// Khớp WpPurchaseSection: ngưỡng "Sắp hết" hiển thị riêng của PDP, độc lập low_stock_threshold.
const PDP_LOW_STOCK_CUTOFF = 10;

function useSnapshot(product: Product, previewMode: boolean): Snapshot | undefined {
  const locale = useLocale();
  const { data } = useQuery<Snapshot>({
    queryKey: ["product-snapshot", product.slug, locale],
    queryFn: async () => {
      const res = await fetch(`/api/products/${product.slug}/snapshot/?lang=${locale}`);
      if (!res.ok) throw new Error("snapshot");
      return res.json() as Promise<Snapshot>;
    },
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
    retry: 2,
    // Xem trước (admin) render bản nháp qua postMessage, slug có thể chưa tồn tại → không poll.
    enabled: !previewMode,
  });
  return data;
}

/** Giá hiển thị = giá hiệu lực (đã tính giảm giá), khớp con số lớn ở nút mua. */
export function TrustLivePrice({ product, previewMode = false }: { product: Product; previewMode?: boolean }) {
  const snap = useSnapshot(product, previewMode);
  const price: ProductPrice = snap
    ? {
        retailPrice: snap.pricing.retailPrice,
        compareAtPrice: snap.pricing.compareAtPrice,
        salePrice: snap.pricing.salePrice,
        currency: "VND",
      }
    : product.price;
  const { current } = derivePricing(price);
  return <>{formatVnd(current)}</>;
}

/**
 * Tồn kho hiển thị — mirror STOCK_RULE_009 ở trạng thái CHƯA chọn biến thể:
 *  • Sản phẩm CÓ biến thể → chỉ Còn/Hết theo aggregate (không hiện "Sắp hết").
 *  • Sản phẩm KHÔNG biến thể → phân tầng theo số serial còn lại (>=10 Còn, 1..9 Sắp hết, <=0 Hết).
 *  • Luôn tôn trọng "tắt bán thủ công" (forceOutOfStock) như nút mua.
 */
export function TrustLiveStock({ product, previewMode = false }: { product: Product; previewMode?: boolean }) {
  const snap = useSnapshot(product, previewMode);

  const hasVariants = (snap?.variants ?? product.variants ?? []).length > 0;
  const qty = snap ? (snap.stock.quantity ?? null) : (product.stockQuantity ?? null);
  const state = (snap?.stock.stockState as ProductStockState | undefined) ?? product.stockState;
  const force = snap ? snap.stock.forceOutOfStock : Boolean(product.forceOutOfStock);

  const stockUnitKnown = !hasVariants;
  const unitOut = typeof qty === "number" ? qty <= 0 : state === "OUT_OF_STOCK";
  const unitLow = !unitOut && (typeof qty === "number" ? qty < PDP_LOW_STOCK_CUTOFF : state === "LOW_STOCK");
  const isOut = force || (stockUnitKnown ? unitOut : state === "OUT_OF_STOCK");
  const isLow = !isOut && stockUnitKnown && unitLow;

  const key: ProductStockState = isOut ? "OUT_OF_STOCK" : isLow ? "LOW_STOCK" : "IN_STOCK";
  return <Tr ns="Product" k={`stockState.${key}`} />;
}
