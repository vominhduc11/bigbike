// Next.js 16 renamed the `middleware` file convention to `proxy`.
// See node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md
// This version keeps the redirect lookup logic but resolves rules through the
// backend and a small in-process cache.

import { NextResponse, type NextRequest } from "next/server";

const API_BASE_URL =
  process.env.BIGBIKE_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:8080";

const TTL_SECONDS = Number.parseInt(
  process.env.BIGBIKE_REDIRECT_CACHE_TTL_SECONDS ?? "300",
  10,
);

// L1 in-process cache â€” prevents redundant backend hits within the same
// worker process. Capped to avoid unbounded growth across many redirect entries.
const L1_MAX = 10_000;
type L1Entry = { value: RedirectLookup | null; expiresAt: number };
const l1Cache = new Map<string, L1Entry>();

function l1Get(key: string): RedirectLookup | null | undefined {
  const entry = l1Cache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    l1Cache.delete(key);
    return undefined;
  }
  return entry.value;
}

function l1Set(key: string, value: RedirectLookup | null): void {
  if (l1Cache.size >= L1_MAX) {
    const first = l1Cache.keys().next().value;
    if (first !== undefined) l1Cache.delete(first);
  }
  l1Cache.set(key, { value, expiresAt: Date.now() + TTL_SECONDS * 1_000 });
}

type RedirectLookup = {
  target: string;
  statusCode: number;
};

async function fetchFromBackend(path: string): Promise<RedirectLookup | null> {
  const url = new URL("/api/internal/redirect", API_BASE_URL);
  url.searchParams.set("path", path);
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(2_000),
    });
    if (response.status === 404) return null;
    if (!response.ok) return null;
    return (await response.json()) as RedirectLookup;
  } catch {
    // Network error or 2 s timeout â€” let the request continue normally.
    return null;
  }
}

async function lookupRedirect(path: string): Promise<RedirectLookup | null> {
  const l1 = l1Get(path);
  if (l1 !== undefined) return l1;

  // WordPress source paths are stored without trailing slashes.
  // Next.js trailingSlash:true may normalize /old-path â†’ /old-path/, so try
  // the de-trailed variant when the exact path yields no result.
  const deslashed =
    path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;

  let fresh = await fetchFromBackend(path);
  if (!fresh && deslashed !== path) {
    fresh = await fetchFromBackend(deslashed);
  }

  l1Set(path, fresh);
  return fresh;
}

function isLoop(currentPath: string, target: string): boolean {
  try {
    const targetPath = target.startsWith("/")
      ? target
      : new URL(target).pathname;
    return targetPath === currentPath;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const pathname = request.nextUrl.pathname;

  // Auth protection: /tai-khoan/* requires bb_session cookie
  if (pathname.startsWith("/tai-khoan")) {
    const sessionCookie = request.cookies.get("bb_session");
    if (!sessionCookie?.value) {
      const loginUrl = new URL("/dang-nhap", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }


  if (pathname === "/" && request.nextUrl.searchParams.has("s")) {
    const query = request.nextUrl.searchParams.get("s")?.trim() ?? "";
    if (query.length > 0) {
      const destination = new URL("/tim-kiem/", request.url);
      destination.searchParams.set("q", query);

      const postType = request.nextUrl.searchParams.get("post_type")?.trim().toLowerCase();
      if (postType === "product") {
        destination.searchParams.set("post_type", "product");
      }

      return NextResponse.redirect(destination, 301);
    }
  }

  const rule = await lookupRedirect(pathname);
  if (!rule) return NextResponse.next();

  if (isLoop(pathname, rule.target)) {
    return NextResponse.next();
  }

  const destination = rule.target.startsWith("/")
    ? new URL(rule.target, request.url)
    : new URL(rule.target);

  return NextResponse.redirect(destination, rule.statusCode || 301);
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|sitemap_index.xml|robots.txt|wp-content).*)",
  ],
};
