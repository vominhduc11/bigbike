import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BACKEND =
  process.env.BIGBIKE_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:8080";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;

  try {
    const res = await fetch(`${BACKEND}/api/v1/products/${id}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Backend returned ${res.status}` },
        { status: res.status },
      );
    }

    const json = (await res.json()) as { data?: Record<string, unknown> };
    const product = json.data ?? (json as Record<string, unknown>);
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

    return NextResponse.json(
      { retailPrice, compareAtPrice, salePrice, discountPercent, currency: price.currency ?? "VND" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Không thể tải dữ liệu giá." },
      { status: 502 },
    );
  }
}
