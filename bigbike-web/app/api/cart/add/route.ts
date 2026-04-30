import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const addCartSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().optional(),
  quantity: z.number().int().min(1).max(999),
});

const BACKEND =
  process.env.BIGBIKE_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:8080";

export async function POST(req: NextRequest) {
  const parsed = addCartSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }
  const body = parsed.data;

  const csrf = req.cookies.get("bb_csrf")?.value ?? "";

  try {
    const res = await fetch(`${BACKEND}/api/v1/cart/items`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-CSRF-Token": csrf,
        Cookie: req.headers.get("cookie") ?? "",
      },
      body: JSON.stringify({
        productId: body.productId,
        quantity: body.quantity,
        productVariantId: body.variantId ?? null,
      }),
    });

    const json = (await res.json().catch(() => null)) as {
      data?: { items?: unknown[] };
      error?: { message?: string };
    } | null;

    if (!res.ok) {
      const msg = json?.error?.message ?? `HTTP ${res.status}`;
      return NextResponse.json({ error: msg }, { status: res.status });
    }

    const cartItems = json?.data?.items ?? [];
    return NextResponse.json({
      success: true,
      cartCount: cartItems.length,
      message: "Đã thêm vào giỏ hàng",
    });
  } catch {
    return NextResponse.json(
      { error: "Không thể thêm vào giỏ hàng." },
      { status: 502 },
    );
  }
}
