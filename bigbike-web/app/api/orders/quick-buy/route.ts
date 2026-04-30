import { type NextRequest, NextResponse } from "next/server";

const BACKEND =
  process.env.BIGBIKE_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:8080";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as unknown;
  const csrf = req.cookies.get("bb_csrf")?.value ?? "";

  try {
    const res = await fetch(`${BACKEND}/api/v1/orders/quick-buy`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-CSRF-Token": csrf,
        Cookie: req.headers.get("cookie") ?? "",
      },
      body: JSON.stringify(body),
    });

    const json = (await res.json().catch(() => null)) as {
      data?: { id?: string; orderNumber?: string; orderKey?: string };
      error?: { message?: string };
    } | null;

    if (!res.ok) {
      const msg = json?.error?.message ?? `HTTP ${res.status}`;
      return NextResponse.json({ error: msg }, { status: res.status });
    }

    const order = json?.data;
    return NextResponse.json({
      orderId: order?.id,
      orderNumber: order?.orderNumber,
      orderKey: order?.orderKey,
    });
  } catch {
    return NextResponse.json(
      { error: "Đặt hàng thất bại, vui lòng thử lại." },
      { status: 502 },
    );
  }
}
