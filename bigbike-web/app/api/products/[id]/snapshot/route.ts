import { proxyBackendJson, type ProductRouteParams } from "@/lib/api/backend-proxy";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: ProductRouteParams) {
  const { id } = await params;
  // Thread `lang` so the buy-box variant options (màu/size) đổi ngôn ngữ theo trang.
  const lang = new URL(req.url).searchParams.get("lang");
  const query = lang === "en" || lang === "vi" ? `?lang=${lang}` : "";

  return proxyBackendJson(`/api/v1/products/${id}/snapshot${query}`, {
    errorMessage: "Không thể tải thông tin sản phẩm.",
    transform: (json) => (json as { data?: unknown }).data ?? {},
  });
}
