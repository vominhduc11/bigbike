import { loadMerchantCatalog } from "@/lib/merchant/catalog";
import { buildMerchantFeed } from "@/lib/merchant/feed";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  try {
    const feed = buildMerchantFeed(await loadMerchantCatalog());
    return new Response(feed.xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex",
        "X-Merchant-Product-Count": String(feed.productCount),
        "X-Merchant-Item-Count": String(feed.itemCount),
      },
    });
  } catch (error) {
    // Log only our fixed diagnostic code; backend error text may contain internal URLs.
    const code =
      error instanceof Error && /^GMC_[A-Z_]+$/.test(error.message)
        ? error.message
        : "GMC_SOURCE_UNAVAILABLE";
    console.error("[google-merchant]", code);
    return new Response("Nguồn sản phẩm tạm thời chưa sẵn sàng. Vui lòng thử lại sau.", {
      status: 503,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex",
        "Retry-After": "300",
      },
    });
  }
}

export async function HEAD(): Promise<Response> {
  const response = await GET();
  return new Response(null, { status: response.status, headers: response.headers });
}
