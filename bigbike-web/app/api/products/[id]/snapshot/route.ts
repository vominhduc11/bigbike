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
    const res = await fetch(`${BACKEND}/api/v1/products/${id}/snapshot`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Backend returned ${res.status}` },
        { status: res.status },
      );
    }

    const json = (await res.json()) as { data?: unknown };
    return NextResponse.json(json.data ?? {}, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "Không thể tải thông tin sản phẩm." },
      { status: 502 },
    );
  }
}
