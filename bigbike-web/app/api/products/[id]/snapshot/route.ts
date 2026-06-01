import { proxyBackendJson, type ProductRouteParams } from "@/lib/api/backend-proxy";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: ProductRouteParams) {
  const { id } = await params;

  return proxyBackendJson(`/api/v1/products/${id}/snapshot`, {
    errorMessage: "Không thể tải thông tin sản phẩm.",
    transform: (json) => (json as { data?: unknown }).data ?? {},
  });
}
