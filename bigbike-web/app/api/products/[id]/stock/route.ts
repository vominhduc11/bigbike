import { proxyBackendJson, type ProductRouteParams } from "@/lib/api/backend-proxy";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: ProductRouteParams) {
  const { id } = await params;
  const isEnglish = new URL(req.url).searchParams.get("lang") === "en";
  const stockLabels: Record<string, string> = isEnglish
    ? { IN_STOCK: "In stock", OUT_OF_STOCK: "Out of stock" }
    : { IN_STOCK: "Còn hàng", OUT_OF_STOCK: "Hết hàng" };

  return proxyBackendJson(req, `/api/v1/products/${id}`, {
    errorMessage: isEnglish ? "Couldn't load stock status." : "Không thể tải trạng thái kho.",
    transform: (json) => {
      const product =
        (json as { data?: Record<string, unknown> }).data ??
        (json as Record<string, unknown>);
      const stockState = (product.stockState as string | undefined) ?? "UNKNOWN";

      return {
        stockState,
        label: stockLabels[stockState] ?? stockState,
      };
    },
  });
}
