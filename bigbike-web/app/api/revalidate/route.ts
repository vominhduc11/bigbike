import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const REVALIDATE_SECRET = process.env.REVALIDATE_SECRET ?? process.env.WEB_REVALIDATE_SECRET;

function parseTags(body: unknown): string[] {
  if (!body || typeof body !== "object" || !("tags" in body) || !Array.isArray((body as { tags: unknown }).tags)) {
    return [];
  }

  return Array.from(
    new Set(
      (body as { tags: unknown[] }).tags
        .filter((tag): tag is string => typeof tag === "string")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0 && tag.length <= 256),
    ),
  );
}

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-revalidate-secret");
  if (!REVALIDATE_SECRET || secret !== REVALIDATE_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const tags = parseTags(body);
  if (tags.length === 0) {
    return NextResponse.json({ error: "No valid tags provided" }, { status: 400 });
  }

  for (const tag of tags) {
    // Next.js 16.x changed revalidateTag to require a second `profile: string | CacheLifeConfig`
    // argument. We pass { expire: 0 } to force immediate cache expiry on the next request —
    // this is the correct form for this version of the framework.
    revalidateTag(tag, { expire: 0 });
  }

  return NextResponse.json({ revalidated: true, tags });
}
