import { NextResponse } from "next/server";
import { env } from "@/env";

export const dynamic = "force-dynamic";

const BACKEND =
  env.BIGBIKE_API_BASE_URL ??
  env.NEXT_PUBLIC_API_BASE_URL ??
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

    return NextResponse.json(
      { variants: (product.variants as unknown[]) ?? [] },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Không thể tải biến thể sản phẩm." },
      { status: 502 },
    );
  }
}
