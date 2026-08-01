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
  const isEnglish = searchParams.get("lang") === "en";
  const reviewLoadError = isEnglish ? "Couldn't load reviews." : "Không thể tải đánh giá.";
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
        { error: isEnglish ? reviewLoadError : error ?? reviewLoadError },
        { status: res.status },
      );
    }

    if (!res.ok) {
      return NextResponse.json(
        { error: reviewLoadError },
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
      { error: reviewLoadError },
      { status: 503 },
    );
  }
}

