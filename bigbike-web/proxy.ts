// Next.js 16 renamed the `middleware` file convention to `proxy`.
// See node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md
// This version keeps the redirect lookup logic but resolves rules through the
// backend and a small in-process cache.

import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { translatePath } from "./lib/utils/routes";

const handleI18nRouting = createMiddleware(routing);

const API_BASE_URL =
  process.env.BIGBIKE_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:8080";

// TTL for the in-process L1 cache. Default is 30 s — low enough that stale
// entries after an admin change expire quickly.
// Admin redirect mutations also call the internal clear endpoint below, so this
// TTL is only a fallback if cross-replica invalidation fails.
const configuredTtlSeconds = Number.parseInt(
  process.env.BIGBIKE_REDIRECT_CACHE_TTL_SECONDS ?? "30",
  10,
);
const TTL_SECONDS = Number.isFinite(configuredTtlSeconds) && configuredTtlSeconds > 0
  ? configuredTtlSeconds
  : 30;
const REDIRECT_CACHE_CLEAR_PATH = "/_internal/redirect-cache/clear";
const REDIRECT_CACHE_CLEAR_SECRET = process.env.REVALIDATE_SECRET ?? process.env.WEB_REVALIDATE_SECRET ?? "";

// Shared secret sent to backend internal endpoints.
// Must match BIGBIKE_INTERNAL_TOKEN on the backend side.
// Required in production (backend defaults to deny-by-default when token not configured).
const INTERNAL_TOKEN = process.env.INTERNAL_API_TOKEN ?? "";

// Warn once at module load time so the issue appears in deploy logs, not per-request.
// Suppress in test/dev because backend uses bigbike.internal.allow-open=true there.
if (!INTERNAL_TOKEN && process.env.NODE_ENV === "production") {
  console.warn(
    "[proxy] INTERNAL_API_TOKEN is not set. Redirect lookups will silently fail because " +
    "the backend requires authentication on /api/internal/** in production " +
    "(bigbike.internal.allow-open defaults to false). " +
    "Set INTERNAL_API_TOKEN to the same value as BIGBIKE_INTERNAL_TOKEN on the backend."
  );
}

const INTERNAL_HEADERS: Record<string, string> = {
  Accept: "application/json",
  ...(INTERNAL_TOKEN ? { "X-Internal-Token": INTERNAL_TOKEN } : {}),
};

// L1 in-process cache — prevents redundant backend hits within the same
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

function clearRedirectL1Cache(): number {
  const size = l1Cache.size;
  l1Cache.clear();
  return size;
}

type RedirectLookup = {
  redirectId: string;
  target: string;
};

async function fetchFromBackend(path: string): Promise<RedirectLookup | null> {
  const url = new URL("/api/internal/redirect", API_BASE_URL);
  url.searchParams.set("path", path);
  try {
    const response = await fetch(url, {
      headers: INTERNAL_HEADERS,
      cache: "no-store",
      signal: AbortSignal.timeout(2_000),
    });
    if (response.status === 404) return null;
    // 401/403 means the backend denied the request — almost certainly a missing/wrong token.
    // Log explicitly so the issue is visible in server logs rather than silently failing.
    if (response.status === 401 || response.status === 403) {
      console.error(
        `[proxy] Backend returned ${response.status} for redirect lookup on "${path}". ` +
        "Verify INTERNAL_API_TOKEN matches BIGBIKE_INTERNAL_TOKEN on the backend. " +
        "Redirects will not function until this is resolved."
      );
      return null;
    }
    if (!response.ok) return null;
    return (await response.json()) as RedirectLookup;
  } catch {
    // Network error or 2 s timeout — let the request continue normally.
    return null;
  }
}

async function recordHit(redirectId: string): Promise<void> {
  const url = new URL(`/api/internal/redirects/hit/${redirectId}`, API_BASE_URL);
  try {
    await fetch(url, {
      method: "POST",
      headers: INTERNAL_HEADERS,
      signal: AbortSignal.timeout(2_000),
    });
  } catch {
    // Non-critical — ignore errors silently.
  }
}

async function lookupRedirect(path: string): Promise<RedirectLookup | null> {
  const l1 = l1Get(path);
  if (l1 !== undefined) return l1;

  // WordPress source paths are stored without trailing slashes.
  // Next.js trailingSlash:true may normalize /old-path â†' /old-path/, so try
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

function normalizeRedirectPath(path: string): string {
  return path.length > 1 ? path.replace(/\/+$/, "") : path;
}

function isLoop(currentPath: string, targetPath: string): boolean {
  return normalizeRedirectPath(targetPath) === normalizeRedirectPath(currentPath);
}

function isAllowedRedirectDestination(request: NextRequest, destination: URL): boolean {
  return (destination.protocol === "http:" || destination.protocol === "https:")
    && destination.hostname.toLowerCase() === request.nextUrl.hostname.toLowerCase();
}

function legacyEnglishCanonicalPath(pathname: string): string | null {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (normalized === "/en/news") return "/en/tin-tuc/";
  if (normalized.startsWith("/en/news/")) {
    return `${normalized.replace("/en/news/", "/en/tin-tuc/")}/`;
  }
  if (normalized.startsWith("/en/products/")) {
    return `${normalized.replace("/en/products/", "/en/product/")}/`;
  }
  return null;
}

function legacyHtmlLookupPath(pathname: string): string | null {
  if (!pathname.toLowerCase().endsWith(".html")) return null;
  if (pathname.startsWith("/vi/")) return pathname.slice(3) || "/";
  if (pathname.startsWith("/en/")) return pathname.slice(3) || "/";
  return pathname;
}

function redirectResponse(
  request: NextRequest,
  rule: RedirectLookup,
  currentPath: string,
  locale: "vi" | "en",
): NextResponse | null {
  // A managed target is either a root-relative path or an absolute http(s) URL
  // on this exact storefront host. Re-check here because legacy DB rows may not
  // have passed the current admin validator.
  if (rule.target.startsWith("//")
      || (!rule.target.startsWith("/") && !/^https?:\/\//i.test(rule.target))) {
    return null;
  }

  const localizedTarget = rule.target.startsWith("/")
    ? translatePath(rule.target, locale)
    : rule.target;
  let destination: URL;
  try {
    destination = localizedTarget.startsWith("/")
      ? new URL(localizedTarget, request.url)
      : new URL(rule.target);
  } catch {
    return null;
  }
  if (!isAllowedRedirectDestination(request, destination)) return null;
  // Compare the final localized pathname with the real incoming pathname. This
  // catches query/fragment self-loops and locale aliases such as /en/product/…
  // that are not visible if only the stored Vietnamese lookup key is compared.
  if (isLoop(request.nextUrl.pathname, destination.pathname)
      || isLoop(currentPath, destination.pathname)) {
    return null;
  }
  if (!destination.search && request.nextUrl.search) {
    destination.search = request.nextUrl.search;
  }
  void recordHit(rule.redirectId);
  return NextResponse.redirect(destination, 301);
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const pathname = request.nextUrl.pathname;
  const legacyEnglishTarget = legacyEnglishCanonicalPath(pathname);

  if (pathname === REDIRECT_CACHE_CLEAR_PATH || pathname === `${REDIRECT_CACHE_CLEAR_PATH}/`) {
    if (request.method !== "POST") {
      return NextResponse.json({ error: "Method Not Allowed" }, { status: 405 });
    }
    const secret = request.headers.get("x-revalidate-secret");
    if (!REDIRECT_CACHE_CLEAR_SECRET || secret !== REDIRECT_CACHE_CLEAR_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const entries = clearRedirectL1Cache();
    return NextResponse.json({ cleared: true, entries });
  }

  const locale = pathname === "/en" || pathname.startsWith("/en/") ? "en" : "vi";
  const firstSegment = pathname.split("/").filter(Boolean)[0]?.toLowerCase();
  if (firstSegment && /^[a-z]{2}$/.test(firstSegment) && !["vi", "en", "sp"].includes(firstSegment)) {
    return new NextResponse(null, {
      status: 404,
      headers: { "X-Robots-Tag": "noindex, nofollow" },
    });
  }

  // Legacy .html URLs must hit the redirect table before locale/trailing-slash
  // normalization. This keeps /vi/...html and /en/...html to one direct 301 hop.
  const htmlLookupPath = legacyHtmlLookupPath(pathname);
  if (htmlLookupPath) {
    const htmlRule = await lookupRedirect(htmlLookupPath);
    if (htmlRule) {
      const response = redirectResponse(request, htmlRule, htmlLookupPath, locale);
      if (response) return response;
    }
  }

  // Vietnamese is canonical without a prefix. Normalize /vi in one permanent
  // hop while retaining query parameters and hashes from the requested URL.
  if (pathname === "/vi" || pathname.startsWith("/vi/")) {
    const destination = request.nextUrl.clone();
    destination.pathname = htmlLookupPath ?? translatePath(pathname, "vi").split(/[?#]/)[0];
    return NextResponse.redirect(destination, 301);
  }

  // Migrate the former unprefixed English URLs to the canonical /en namespace.
  const oldEnglishRoots = new Set([
    "products", "categories", "news", "cart", "order", "orders", "account",
    "login", "register", "forgot-password", "verify-email", "search", "contact",
    "about", "policy", "guide",
  ]);
  if (firstSegment && oldEnglishRoots.has(firstSegment) && locale === "vi") {
    const destination = request.nextUrl.clone();
    destination.pathname = translatePath(pathname, "en").split(/[?#]/)[0];
    return NextResponse.redirect(destination, 301);
  }

  if (
    pathname !== "/" &&
    !pathname.endsWith("/") &&
    !pathname.includes(".")
  ) {
    // Tra bảng redirect TRƯỚC khi chuẩn hoá dấu "/" cuối. 489 luật legacy lưu
    // sourcePattern không kèm "/" cuối; nếu 308 trước thì mỗi luật tốn 2 hop
    // (308 thêm "/" → 301 tới đích) thay vì 1. isLoop trong redirectResponse đã
    // bỏ qua "/" cuối khi so sánh, nên luật /x→/x/ vẫn rơi xuống nhánh 308 dưới.
    const slashlessRule = await lookupRedirect(
      translatePath(pathname, "vi").split(/[?#]/)[0],
    );
    if (slashlessRule) {
      const response = redirectResponse(request, slashlessRule, pathname, locale);
      if (response) return response;
    }

    const destination = new URL(request.url);
    destination.pathname = `${pathname}/`;
    return NextResponse.redirect(destination.toString(), 308);
  }

  const viPathname = translatePath(pathname, "vi").split(/[?#]/)[0];

  // Auth protection preserves the requested locale and complete return URL.
  if (viPathname.startsWith("/tai-khoan/")) {
    const sessionCookie = request.cookies.get("bb_session");
    if (!sessionCookie?.value) {
      const loginUrl = new URL(translatePath("/dang-nhap/", locale), request.url);
      loginUrl.searchParams.set("tiep", `${pathname}${request.nextUrl.search}`);
      return NextResponse.redirect(loginUrl);
    }
  }

  if ((pathname === "/" || pathname === "/en/") && request.nextUrl.searchParams.has("s")) {
    const query = request.nextUrl.searchParams.get("s")?.trim() ?? "";
    if (query.length > 0) {
      const destination = new URL(translatePath("/tim-kiem/", locale), request.url);
      destination.searchParams.set("q", query);

      const postType = request.nextUrl.searchParams.get("post_type")?.trim().toLowerCase();
      if (postType === "product") {
        destination.searchParams.set("post_type", "product");
      }

      return NextResponse.redirect(destination, 301);
    }
  }

  const rule = await lookupRedirect(viPathname);
  if (!rule) {
    if (legacyEnglishTarget) {
      const destination = request.nextUrl.clone();
      destination.pathname = legacyEnglishTarget;
      return NextResponse.redirect(destination, 301);
    }
    return handleI18nRouting(request);
  }

  return redirectResponse(request, rule, viPathname, locale) ?? handleI18nRouting(request);
}

export const config = {
  matcher: [
    // Locale routing only applies to document URLs. Public assets, media and
    // metadata files must retain their original paths instead of being rewritten
    // beneath /vi or /en.
    // `xml` giữ cho /sitemap.xml + /brand/favicon/browserconfig.xml, `ttf|otf|eot`
    // giữ cho 12 font trong public/fonts, còn `mp4|webm|mp3|wasm|mjs` là loại file
    // tĩnh có thể thêm sau này. Thiếu chúng thì next-intl viết lại đường dẫn xuống
    // /vi/... và file trả 404 (sitemap còn trả nhầm HTML) — đã đo 2026-08-06.
    "/((?!api|_next|_vercel|.*\\.(?:avif|css|eot|gif|ico|jpe?g|js|json|map|mjs|mp3|mp4|otf|pdf|png|svg|ttf|txt|wasm|webm|webmanifest|webp|woff2?|xml)$).*)",
  ],
};
