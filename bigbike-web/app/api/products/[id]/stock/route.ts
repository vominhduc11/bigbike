import { proxyBackendJson, type ProductRouteParams } from "@/lib/api/backend-proxy";

export const dynamic = "force-dynamic";

const STOCK_LABELS: Record<string, string> = {
  IN_STOCK: "Còn hàng",
  OUT_OF_STOCK: "Hết hàng",
};

export async function GET(_req: Request, { params }: ProductRouteParams) {
  const { id } = await params;

  return proxyBackendJson(`/api/v1/products/${id}`, {
    errorMessage: "Không thể tải trạng thái kho.",
    transform: (json) => {
      const product =
        (json as { data?: Record<string, unknown> }).data ??
        (json as Record<string, unknown>);
      const stockState = (product.stockState as string | undefined) ?? "UNKNOWN";

      return {
        stockState,
        label: STOCK_LABELS[stockState] ?? stockState,
        forceOutOfStock: Boolean(product.forceOutOfStock),
      };
    },
  });
}
