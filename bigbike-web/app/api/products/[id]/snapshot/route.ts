import { proxyBackendJson, type ProductRouteParams } from "@/lib/api/backend-proxy";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: ProductRouteParams) {
  const { id } = await params;
  // Thread `lang` so the buy-box variant options (màu/size) đổi ngôn ngữ theo trang.
  const lang = new URL(req.url).searchParams.get("lang");
  const isEnglish = lang === "en";
  const query = lang === "en" || lang === "vi" ? `?lang=${lang}` : "";

  return proxyBackendJson(`/api/v1/products/${id}/snapshot${query}`, {
    errorMessage: isEnglish ? "Couldn't load product information." : "Không thể tải thông tin sản phẩm.",
    transform: (json) => (json as { data?: unknown }).data ?? {},
  });
}
