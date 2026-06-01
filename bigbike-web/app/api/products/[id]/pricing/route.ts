import { proxyBackendJson, type ProductRouteParams } from "@/lib/api/backend-proxy";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: ProductRouteParams) {
  const { id } = await params;

  return proxyBackendJson(`/api/v1/products/${id}`, {
    errorMessage: "Không thể tải dữ liệu giá.",
    transform: (json) => {
      const product =
        (json as { data?: Record<string, unknown> }).data ??
        (json as Record<string, unknown>);
      const price = (product.price ?? {}) as {
        retailPrice?: number;
        compareAtPrice?: number;
        salePrice?: number;
        currency?: string;
      };

      const retailPrice = price.retailPrice ?? 0;
      const compareAtPrice = price.compareAtPrice ?? null;
      const salePrice = price.salePrice ?? null;
      const effectivePrice = salePrice ?? retailPrice;
      const discountPercent =
        compareAtPrice && compareAtPrice > effectivePrice
          ? Math.round((1 - effectivePrice / compareAtPrice) * 100)
          : 0;

      return { retailPrice, compareAtPrice, salePrice, discountPercent, currency: price.currency ?? "VND" };
    },
  });
}
