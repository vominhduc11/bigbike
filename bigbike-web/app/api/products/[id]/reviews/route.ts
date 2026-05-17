import { NextResponse } from "next/server";
import { env } from "@/env";

export const dynamic = "force-dynamic";

const BACKEND =
  env.BIGBIKE_API_BASE_URL ??
  env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:8080";

type Params = { params: Promise<{ id: string }> };

type Pagination = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
};

type BackendErrorPayload =
  | {
      error?: {
        message?: string;
      };
      message?: string;
    }
  | null;

const EMPTY = {
  avgRating: 0,
  totalReviews: 0,
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

async function readBackendError(res: Response) {
  const payload = (await res.json().catch(() => null)) as BackendErrorPayload;
  return payload?.error?.message ?? payload?.message ?? null;
}

export async function GET(req: Request, { params }: Params) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const upstreamParams = new URLSearchParams();
  const page = searchParams.get("page");
  const size = searchParams.get("size");

  if (page) upstreamParams.set("page", page);
  if (size) upstreamParams.set("size", size);

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
        reviews?: unknown[];
        pagination?: Partial<Pagination>;
      };
    };
    const data = json.data ?? (json as typeof json["data"]);

    return NextResponse.json(
      {
        avgRating: data?.avgRating ?? 0,
        totalReviews: data?.totalReviews ?? 0,
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

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;

  let body: { authorName?: string; rating?: number; comment?: string; website?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }

  const { authorName, rating, comment, website } = body;

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
      body: JSON.stringify({
        authorName: authorName.trim(),
        rating,
        comment: comment?.trim() ?? "",
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
