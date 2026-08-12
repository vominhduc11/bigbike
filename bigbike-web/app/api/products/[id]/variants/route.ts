import { proxyBackendJson, type ProductRouteParams } from "@/lib/api/backend-proxy";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: ProductRouteParams) {
  const { id } = await params;
  const isEnglish = new URL(req.url).searchParams.get("lang") === "en";

  return proxyBackendJson(req, `/api/v1/products/${id}`, {
    errorMessage: isEnglish ? "Couldn't load product variants." : "Không thể tải biến thể sản phẩm.",
    transform: (json) => {
      const product =
        (json as { data?: Record<string, unknown> }).data ??
        (json as Record<string, unknown>);
      return { variants: (product.variants as unknown[]) ?? [] };
    },
  });
}
