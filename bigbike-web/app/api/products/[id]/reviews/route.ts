import { NextResponse } from "next/server";
import { BACKEND, readBackendError, type ProductRouteParams } from "@/lib/api/backend-proxy";

export const dynamic = "force-dynamic";

type Pagination = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
};

// REVIEW_RULE_008: 9 mức nửa sao (5 → 1, bước 0,5).
const EMPTY_BREAKDOWN: Record<string, number> = {
  "5": 0,
  "4.5": 0,
  "4": 0,
  "3.5": 0,
  "3": 0,
  "2.5": 0,
  "2": 0,
  "1.5": 0,
  "1": 0,
};

const EMPTY = {
  avgRating: 0,
  totalReviews: 0,
  ratingBreakdown: EMPTY_BREAKDOWN,
  reviews: [],
  pagination: {
    page: 1,
    pageSize: 10,
    totalItems: 0,
    totalPages: 0,
    hasNext: false,
    hasPrevious: false,
  } satisfies Pagination,
};

export async function GET(req: Request, { params }: ProductRouteParams) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const upstreamParams = new URLSearchParams();
  const page = searchParams.get("page");
  const size = searchParams.get("size");
  const rating = searchParams.get("rating");
  const sort = searchParams.get("sort");

  if (page) upstreamParams.set("page", page);
  if (size) upstreamParams.set("size", size);
  if (rating) upstreamParams.set("rating", rating);
  if (sort) upstreamParams.set("sort", sort);

  const query = upstreamParams.size ? `?${upstreamParams.toString()}` : "";

  try {
    const res = await fetch(`${BACKEND}/api/v1/products/${id}/reviews${query}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    if (res.status === 404) {
      // PDP should stay stable when the product lookup behind reviews returns not found.
      return NextResponse.json(EMPTY);
    }

    if (res.status >= 400 && res.status < 500) {
      const error = await readBackendError(res);
      return NextResponse.json(
        { error: error ?? "Không thể tải đánh giá." },
        { status: res.status },
      );
    }

    if (!res.ok) {
      return NextResponse.json(
        { error: "Không thể tải đánh giá." },
        { status: res.status || 503 },
      );
    }

    const json = (await res.json()) as {
      data?: {
        avgRating?: number;
        totalReviews?: number;
        ratingBreakdown?: Record<string, number>;
        reviews?: unknown[];
        pagination?: Partial<Pagination>;
      };
    };
    const data = json.data ?? (json as typeof json["data"]);

    return NextResponse.json(
      {
        avgRating: data?.avgRating ?? 0,
        totalReviews: data?.totalReviews ?? 0,
        ratingBreakdown: data?.ratingBreakdown ?? EMPTY_BREAKDOWN,
        reviews: data?.reviews ?? [],
        pagination: {
          page: data?.pagination?.page ?? Number(page ?? 1),
          pageSize: data?.pagination?.pageSize ?? Number(size ?? 10),
          totalItems: data?.pagination?.totalItems ?? 0,
          totalPages: data?.pagination?.totalPages ?? 0,
          hasNext: data?.pagination?.hasNext ?? false,
          hasPrevious: data?.pagination?.hasPrevious ?? false,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Không thể tải đánh giá." },
      { status: 503 },
    );
  }
}

export async function POST(req: Request, { params }: ProductRouteParams) {
  const { id } = await params;

  let body: {
    authorName?: string;
    rating?: number;
    comment?: string;
    photos?: unknown;
    website?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }

  const { authorName, rating, comment, photos, website } = body;

  if (!authorName?.trim()) {
    return NextResponse.json({ error: "Vui lòng nhập tên." }, { status: 400 });
  }
  // REVIEW_RULE_008: bước 0,5 sao — nhân đôi phải ra số nguyên (1.0..5.0 → 2..10).
  if (typeof rating !== "number" || rating < 1 || rating > 5 || !Number.isInteger(rating * 2)) {
    return NextResponse.json({ error: "Đánh giá phải từ 1 đến 5 sao." }, { status: 400 });
  }
  // Keep only string photo URLs, cap at 10 — backend re-validates they are MinIO URLs.
  const photoUrls = Array.isArray(photos)
    ? photos.filter((p): p is string => typeof p === "string" && p.trim().length > 0).slice(0, 10)
    : [];

  // Forward only the bb_session cookie (never the full Cookie header) so a review
  // submitted while logged in can be linked to the customer's account server-side —
  // never the full Cookie header, to avoid leaking bb_csrf/other cookies to this
  // server-to-server call.
  const rawCookie = req.headers.get("cookie") ?? "";
  const sessionMatch = rawCookie.match(/(?:^|;\s*)bb_session=([^;]*)/);
  const sessionCookie = sessionMatch ? `bb_session=${sessionMatch[1]}` : null;

  try {
    const res = await fetch(`${BACKEND}/api/v1/products/${id}/reviews`, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(sessionCookie ? { Cookie: sessionCookie } : {}),
      },
      body: JSON.stringify({
        authorName: authorName.trim(),
        rating,
        comment: comment?.trim() ?? "",
        photos: photoUrls,
        website: website ?? "",
      }),
    });

    if (!res.ok) {
      const error = await readBackendError(res);
      return NextResponse.json(
        { error: error ?? "Không thể gửi đánh giá." },
        { status: res.status },
      );
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Lỗi kết nối, vui lòng thử lại." }, { status: 503 });
  }
}
