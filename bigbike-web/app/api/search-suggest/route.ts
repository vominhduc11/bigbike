import { NextResponse } from "next/server";
import { env } from "@/env";

export const dynamic = "force-dynamic";

const BACKEND =
  env.BIGBIKE_API_BASE_URL ??
  env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:8080";

type ProductSummary = {
  id: string;
  slug: string;
  name: string;
  price?: { retailPrice?: number; salePrice?: number } | null;
  image?: { url?: string } | null;
};

type ArticleSummary = {
  id: string;
  slug: string;
  title: string;
  category?: { name: string } | null;
  coverImage?: { url?: string } | null;
};

const EMPTY = { products: [] as ProductSummary[], articles: [] as ArticleSummary[] };

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  if (q.length < 1) return NextResponse.json(EMPTY);

  try {
    const url = new URL(`${BACKEND}/api/v1/search-suggest`);
    url.searchParams.set("q", q);
    url.searchParams.set("limit", "10");

    const res = await fetch(url.toString(), {
      next: { revalidate: 30 },
      headers: { Accept: "application/json" },
    });

    if (!res.ok) return NextResponse.json(EMPTY);

    const json = (await res.json()) as {
      data?: {
        products?: ProductSummary[];
        articles?: ArticleSummary[];
      };
    };

    return NextResponse.json(
      {
        products: (json.data?.products ?? []).slice(0, 5),
        articles: (json.data?.articles ?? []).slice(0, 5),
      },
      { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } },
    );
  } catch {
    return NextResponse.json(EMPTY);
  }
}
