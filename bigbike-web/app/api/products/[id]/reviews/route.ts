import { NextResponse } from "next/server";

const BACKEND =
  process.env.BIGBIKE_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:8080";

type Params = { params: Promise<{ id: string }> };

const EMPTY = { avgRating: 0, totalReviews: 0, reviews: [] };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;

  try {
    const res = await fetch(`${BACKEND}/api/v1/products/${id}/reviews`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    if (res.status === 404) {
      return NextResponse.json(EMPTY);
    }

    if (!res.ok) {
      return NextResponse.json(EMPTY);
    }

    const json = (await res.json()) as {
      data?: { avgRating?: number; totalReviews?: number; reviews?: unknown[] };
    };
    const data = json.data ?? (json as typeof json["data"]);

    return NextResponse.json(
      {
        avgRating: data?.avgRating ?? 0,
        totalReviews: data?.totalReviews ?? 0,
        reviews: data?.reviews ?? [],
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(EMPTY);
  }
}

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;

  let body: { authorName?: string; rating?: number; comment?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }

  const { authorName, rating, comment } = body;

  if (!authorName?.trim()) {
    return NextResponse.json({ error: "Vui lòng nhập tên." }, { status: 400 });
  }
  if (typeof rating !== "number" || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Đánh giá phải từ 1 đến 5 sao." }, { status: 400 });
  }

  try {
    const res = await fetch(`${BACKEND}/api/v1/products/${id}/reviews`, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ authorName: authorName.trim(), rating, comment: comment?.trim() ?? "" }),
    });

    if (!res.ok) {
      const errJson = (await res.json().catch(() => null)) as { message?: string } | null;
      return NextResponse.json(
        { error: errJson?.message ?? "Không thể gửi đánh giá." },
        { status: res.status },
      );
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Lỗi kết nối, vui lòng thử lại." }, { status: 503 });
  }
}
