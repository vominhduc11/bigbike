"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale } from "next-intl";
import type { Product, ProductPrice, ProductStockState } from "@/lib/contracts/public";
import { derivePricing } from "@/lib/pricing";
import { formatVnd } from "@/lib/utils/format";
import { Tr } from "@/components/i18n/Tr";

// Giá + tồn kho cho khối "Mua tại BigBike.vn" (#12). Trước đây khối này đọc giá/tồn TĨNH
// lúc dựng trang nên LỆCH với khu mua hàng chính (PurchaseSection): không tính giảm giá,
// không tính trạng thái "tắt bán thủ công" → có thể hiện "Còn hàng"/giá gốc trong khi nút
// mua đã "Hết hàng"/giá khuyến mãi. Ở đây dùng CHUNG nguồn thời gian thực: cùng queryKey
// ["product-snapshot", slug, locale] nên react-query chia sẻ cache, KHÔNG fetch thừa.

type Snapshot = {
  pricing: { retailPrice: number; salePrice: number | null; discountPercent: number; currency: string };
  stock: { stockState: string; label: string; forceOutOfStock: boolean };
  variants: unknown[];
};

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
        salePrice: snap.pricing.salePrice,
        currency: "VND",
      }
    : product.price;
  const { current } = derivePricing(price);
  return <>{formatVnd(current)}</>;
}

/**
 * Tồn kho hiển thị — mirror STOCK_RULE_009: mô hình boolean Còn/Hết, KHÔNG hiển
 * thị số lượng và KHÔNG còn tầng "Sắp hết". Trạng thái lấy từ stockState tổng,
 * luôn tôn trọng "tắt bán thủ công" (forceOutOfStock) như nút mua.
 */
export function TrustLiveStock({ product, previewMode = false }: { product: Product; previewMode?: boolean }) {
  const snap = useSnapshot(product, previewMode);

  const state = (snap?.stock.stockState as ProductStockState | undefined) ?? product.stockState;
  const force = snap ? snap.stock.forceOutOfStock : Boolean(product.forceOutOfStock);

  const isOut = force || state === "OUT_OF_STOCK";
  const key: ProductStockState = isOut ? "OUT_OF_STOCK" : "IN_STOCK";
  // "Còn hàng" xanh success (ngoại lệ chức năng — xem STYLEGUIDE.md State colors); "Hết hàng"
  // giữ màu chữ mặc định, không dùng đỏ brand để tránh giành sự chú ý với giá/CTA.
  return (
    <span className={isOut ? undefined : "text-success"}>
      <Tr ns="Product" k={`stockState.${key}`} />
    </span>
  );
}
