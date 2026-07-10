import { revalidatePath, revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { env } from "@/env";

export const runtime = "nodejs";

const REVALIDATE_SECRET = env.REVALIDATE_SECRET ?? env.WEB_REVALIDATE_SECRET;

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

function pathsForTag(tag: string): string[] {
  if (tag === "products") return ["/san-pham/", "/"];
  if (tag === "categories") return ["/san-pham/", "/"];
  if (tag === "brands") return ["/brands/", "/san-pham/"];
  if (tag === "articles") return ["/tin-tuc/", "/"];
  if (tag === "settings") return ["/", "/san-pham/", "/brands/", "/tin-tuc/"];
  if (tag === "menus") return ["/"];
  if (tag === "sliders" || tag === "home-videos" || tag === "home-highlights") return ["/"];

  const [kind, ...rest] = tag.split(":");
  const slug = rest.join(":").trim();
  if (!slug) return [];

  if (kind === "product") return [`/product/${slug}/`, "/san-pham/"];
  if (kind === "category") return [`/danh-muc-san-pham/${slug}/`, "/san-pham/"];
  if (kind === "brand") return [`/brands/${slug}/`, "/brands/", "/san-pham/"];
  if (kind === "article") return [`/tin-tuc/${slug}/`, "/tin-tuc/"];

  return [];
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

  const paths = new Set<string>();
  for (const tag of tags) {
    // Next.js 16 recommends profile="max": it marks tagged data stale without deleting
    // fallback=false prerenders such as hardcoded guide/static-policy pages.
    revalidateTag(tag, "max");
    for (const path of pathsForTag(tag)) {
      paths.add(path);
    }
  }

  for (const path of paths) {
    revalidatePath(path);
  }

  return NextResponse.json({ revalidated: true, tags, paths: Array.from(paths) });
}
