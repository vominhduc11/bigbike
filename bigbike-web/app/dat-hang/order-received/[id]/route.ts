import { NextRequest, NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  const query = new URLSearchParams({ so: id });
  const key = request.nextUrl.searchParams.get("key");
  if (key) {
    query.set("key", key);
  }

  return NextResponse.redirect(new URL(`/don-hang/xac-nhan/?${query.toString()}`, request.url), 308);
}
