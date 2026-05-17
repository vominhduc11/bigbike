import { NextResponse } from "next/server";
import { env } from "@/env";

export const dynamic = "force-dynamic";

const BACKEND =
  env.BIGBIKE_API_BASE_URL ??
  env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:8080";

type Params = { params: Promise<{ id: string }> };

const STOCK_LABELS: Record<string, string> = {
  IN_STOCK: "Còn hàng",
  LOW_STOCK: "Còn ít",
  OUT_OF_STOCK: "Hết hàng",
};

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
    const stockState = (product.stockState as string | undefined) ?? "UNKNOWN";

    return NextResponse.json(
      {
        stockState,
        label: STOCK_LABELS[stockState] ?? stockState,
        forceOutOfStock: Boolean(product.forceOutOfStock),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Không thể tải trạng thái kho." },
      { status: 502 },
    );
  }
}
