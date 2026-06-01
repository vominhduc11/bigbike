import { proxyBackendJson, type ProductRouteParams } from "@/lib/api/backend-proxy";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: ProductRouteParams) {
  const { id } = await params;

  return proxyBackendJson(`/api/v1/products/${id}`, {
    errorMessage: "Không thể tải biến thể sản phẩm.",
    transform: (json) => {
      const product =
        (json as { data?: Record<string, unknown> }).data ??
        (json as Record<string, unknown>);
      return { variants: (product.variants as unknown[]) ?? [] };
    },
  });
}
