// Next.js 16 renamed the `middleware` file convention to `proxy`.
// See node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md
// This version keeps the redirect lookup logic but resolves rules through the
// backend and a small in-process cache.

import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { translatePath } from "./lib/utils/routes";

const handleI18nRouting = createMiddleware(routing);

function handleI18nRequest(request: NextRequest): NextResponse {
  const response = handleI18nRouting(request);
  const location = response.headers.get("location");
  const rewrite = response.headers.get("x-middleware-rewrite");
  if (!location || !rewrite) return response;

  try {
    const requestedUrl = new URL(request.url);
    const locationUrl = new URL(location, request.url);
    if (
      normalizeRedirectPath(locationUrl.pathname) !== normalizeRedirectPath(requestedUrl.pathname)
      || locationUrl.search !== requestedUrl.search
    ) {
      return response;
    }
    return NextResponse.rewrite(new URL(rewrite, request.url));
  } catch {
    return response;
  }
}

function hasExplicitLocalePrefix(pathname: string): boolean {
  return pathname === "/vi"
    || pathname.startsWith("/vi/")
    || pathname === "/en"
    || pathname.startsWith("/en/");
}

function rewriteDefaultLocaleRequest(request: NextRequest): NextResponse {
  const destination = request.nextUrl.clone();
  if (destination.pathname === "/") {
    // The public home path is also the next-intl root route. Rewriting it to a
    // private route keeps production next-intl from turning the internal
    // `/vi/` rewrite into a visible `/` self-redirect.
    destination.pathname = "/vi/internal/home/";
  } else if (destination.pathname === "/sp" || destination.pathname.startsWith("/sp/")) {
    // `/sp/` is the Vietnamese canonical catalog URL, but it is also a
    // localized pathname in the next-intl registry. Use an internal alias so
    // the request remains a 200 instead of becoming a `/sp/` redirect loop.
    destination.pathname = `/vi/internal${destination.pathname}`;
  } else {
    destination.pathname = `/vi${destination.pathname}`;
  }
  return NextResponse.rewrite(destination);
}

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
type L1Entry = { value: RedirectLookup; expiresAt: number };
const l1Cache = new Map<string, L1Entry>();

function l1Get(key: string): RedirectLookup | undefined {
  const entry = l1Cache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    l1Cache.delete(key);
    return undefined;
  }
  return entry.value;
}

function l1Set(key: string, value: RedirectLookup): void {
  if (l1Cache.size >= L1_MAX) {
    const first = l1Cache.keys().next().value;
    if (first !== undefined) l1Cache.delete(first);
  }
  l1Cache.set(key, { value, expiresAt: Date.now() + TTL_SECONDS * 1_000 });
}

type RedirectLookup = {
  redirectId: string;
  target: string;
  statusCode: 301 | 410;
};

type BackendLookupResult =
  | { kind: "hit"; value: RedirectLookup }
  | { kind: "miss" }
  | { kind: "transient" };

type ActiveRedirectItem = {
  id: string;
  sourcePattern: string;
  targetUrl: string;
  statusCode: 301 | 410;
};

type ActiveRedirectSnapshot = {
  rules: Map<string, RedirectLookup>;
  loadedAt: number;
};

let activeRedirectSnapshot: ActiveRedirectSnapshot | null = null;
let activeRedirectSnapshotPromise: Promise<ActiveRedirectSnapshot | null> | null = null;
let activeRedirectSnapshotGeneration = 0;

function clearRedirectCaches(): { entries: number; snapshot: boolean } {
  const size = l1Cache.size;
  l1Cache.clear();
  const hadSnapshot = activeRedirectSnapshot !== null || activeRedirectSnapshotPromise !== null;
  activeRedirectSnapshot = null;
  activeRedirectSnapshotGeneration += 1;
  // An in-flight request may still finish, but its generation check prevents it
  // from repopulating the cache after an admin mutation has cleared it.
  activeRedirectSnapshotPromise = null;
  return { entries: size, snapshot: hadSnapshot };
}

/** @internal — keeps cache-isolation tests deterministic without changing runtime behavior. */
export function clearRedirectCachesForTests(): void {
  clearRedirectCaches();
}

async function fetchFromBackend(path: string): Promise<BackendLookupResult> {
  const url = new URL("/api/internal/redirect", API_BASE_URL);
  url.searchParams.set("path", path);
  try {
    const response = await fetch(url, {
      headers: INTERNAL_HEADERS,
      cache: "no-store",
      signal: AbortSignal.timeout(2_000),
    });
    if (response.status === 404) return { kind: "miss" };
    // 401/403 means the backend denied the request — almost certainly a missing/wrong token.
    // Log explicitly so the issue is visible in server logs rather than silently failing.
    if (response.status === 401 || response.status === 403) {
      console.error(
        `[proxy] Backend returned ${response.status} for redirect lookup on "${path}". ` +
        "Verify INTERNAL_API_TOKEN matches BIGBIKE_INTERNAL_TOKEN on the backend. " +
        "Redirects will not function until this is resolved."
      );
      return { kind: "transient" };
    }
    if (!response.ok) return { kind: "transient" };
    const payload = (await response.json()) as Partial<RedirectLookup>;
    if (!payload.redirectId || !payload.target) return { kind: "transient" };
    return {
      kind: "hit",
      value: {
        redirectId: payload.redirectId,
        target: payload.target,
        statusCode: payload.statusCode === 410 ? 410 : 301,
      },
    };
  } catch {
    // Network error or 2 s timeout — let the request continue normally.
    return { kind: "transient" };
  }
}

async function fetchActiveRedirectSnapshot(): Promise<ActiveRedirectSnapshot | null> {
  const url = new URL("/api/internal/redirects/active", API_BASE_URL);
  try {
    const response = await fetch(url, {
      headers: INTERNAL_HEADERS,
      cache: "no-store",
      signal: AbortSignal.timeout(2_000),
    });
    if (!response.ok) return null;
    const payload = await response.json() as unknown;
    if (!Array.isArray(payload)) return null;

    const rules = new Map<string, RedirectLookup>();
    for (const item of payload as Partial<ActiveRedirectItem>[]) {
      if (!item.id || !item.sourcePattern || !item.targetUrl) continue;
      if (item.statusCode !== 301 && item.statusCode !== 410) continue;
      rules.set(item.sourcePattern, {
        redirectId: item.id,
        target: item.targetUrl,
        statusCode: item.statusCode,
      });
    }
    return { rules, loadedAt: Date.now() };
  } catch {
    // A failed snapshot is not an empty snapshot. lookupRedirect will use the
    // single-path endpoint for this request and try the snapshot again later.
    return null;
  }
}

async function getActiveRedirectSnapshot(): Promise<ActiveRedirectSnapshot | null> {
  if (
    activeRedirectSnapshot &&
    activeRedirectSnapshot.loadedAt + TTL_SECONDS * 1_000 > Date.now()
  ) {
    return activeRedirectSnapshot;
  }
  if (activeRedirectSnapshotPromise) return activeRedirectSnapshotPromise;

  const generation = activeRedirectSnapshotGeneration;
  const requestPromise = fetchActiveRedirectSnapshot()
    .then((snapshot) => {
      if (snapshot && generation === activeRedirectSnapshotGeneration) {
        activeRedirectSnapshot = snapshot;
      }
      return snapshot;
    })
    .finally(() => {
      if (activeRedirectSnapshotPromise === requestPromise) {
        activeRedirectSnapshotPromise = null;
      }
    });
  activeRedirectSnapshotPromise = requestPromise;
  return requestPromise;
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
  // Next.js trailingSlash:true may normalize /old-path → /old-path/, so try
  // the de-trailed variant when the exact path yields no result.
  const deslashed =
    path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;

  const snapshot = await getActiveRedirectSnapshot();
  if (snapshot) {
    const fresh = snapshot.rules.get(path) ??
      (deslashed !== path ? snapshot.rules.get(deslashed) : undefined);
    if (fresh) l1Set(path, fresh);
    return fresh ?? null;
  }

  const exact = await fetchFromBackend(path);
  let fresh = exact.kind === "hit" ? exact.value : null;
  if (!fresh && exact.kind !== "transient" && deslashed !== path) {
    const fallback = await fetchFromBackend(deslashed);
    fresh = fallback.kind === "hit" ? fallback.value : null;
  }

  // Positive-only L1 caching is deliberate: a transient backend outage must
  // never turn into a sticky negative redirect result.
  if (fresh) l1Set(path, fresh);
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
  return pathname;
}

function legacyProductRewritePath(pathname: string, locale: "vi" | "en"): string | null {
  const prefix = locale === "en"
    ? "/en/sp/"
    : pathname.startsWith("/vi/sp/") ? "/vi/sp/" : "/sp/";
  if (!pathname.startsWith(prefix) || !pathname.toLowerCase().endsWith(".html")) return null;
  const slug = pathname.slice(prefix.length, -".html".length);
  if (!slug || slug.includes("/")) return null;
  return `/${locale}/legacy/sp/${slug}.html`;
}

async function lookupLegacyHtmlRedirect(pathname: string): Promise<RedirectLookup | null> {
  // Admin sources may intentionally include /en/ while older Vietnamese rows omit /vi/.
  // Prefer the exact stored path so an English row can never accidentally inherit a
  // Vietnamese rule; only then try the locale-less legacy spelling.
  const exact = await lookupRedirect(pathname);
  if (exact) return exact;
  if (pathname.startsWith("/vi/") || pathname.startsWith("/en/")) {
    return lookupRedirect(pathname.slice(3) || "/");
  }
  return null;
}

function brandSlugFromPath(pathname: string): string | null {
  const normalized = pathname.replace(/\/+$/, "");
  const match = normalized.match(/^(?:\/en|\/vi)?\/brands\/([^/]+)$/i);
  return match?.[1] ?? null;
}

async function lookupPublicBrandExists(slug: string, locale: "vi" | "en"): Promise<boolean | null> {
  const url = new URL(`/api/v1/brands/${encodeURIComponent(slug)}`, API_BASE_URL);
  url.searchParams.set("lang", locale);
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(2_000),
    });
    if (response.status === 404) return false;
    return response.ok ? true : null;
  } catch {
    return null;
  }
}

// Bài viết không tồn tại phải trả 404 thật (SEO_RULE_005). Route
// `/[locale]/tin-tuc/[slug]` không tự làm được: `app/[locale]/(storefront)/tin-tuc/loading.tsx`
// bọc cả nhánh con trong Suspense nên Next đã stream shell (status 200) trước khi
// `notFound()` chạy — y hệt lý do thương hiệu phải đi đường vòng này. Chặn ở proxy
// để Google nhận 404 thay vì "soft 404".
function articleSlugFromPath(pathname: string): string | null {
  const normalized = pathname.replace(/\/+$/, "");
  const match = normalized.match(/^(?:\/en|\/vi)?\/tin-tuc\/([^/]+)$/i);
  const slug = match?.[1];
  if (!slug) return null;
  // `/tin-tuc/{slug}.html` đời cũ đã qua bảng redirect ở trên mà không khớp luật nào:
  // tra bằng slug sạch để bài còn sống không bị 404 oan.
  return slug.toLowerCase().endsWith(".html") ? slug.slice(0, -".html".length) : slug;
}

async function lookupPublicArticleExists(slug: string, locale: "vi" | "en"): Promise<boolean | null> {
  if (!slug) return null;
  const url = new URL(`/api/v1/articles/${encodeURIComponent(slug)}`, API_BASE_URL);
  url.searchParams.set("lang", locale);
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(2_000),
    });
    if (response.status === 404) return false;
    return response.ok ? true : null;
  } catch {
    return null;
  }
}

function goneCategoryPath(sourcePath: string): string {
  const source = sourcePath.toLowerCase();
  if (source.includes("of606")) return "/danh-muc/mu-bao-hiem-3-4/";
  if (source.includes("scoyco-mt068") || source.includes("forma-")) {
    return "/danh-muc/giay-bao-ho-moto-phuot/";
  }
  if (source.includes("sw-motech") || source.includes("kriega") || source.includes("drybag")) {
    return "/danh-muc/balo-tui-deo-tui-treo-xe/";
  }
  if (source.includes("apollo") || source.includes("zoom-lady")) {
    return "/danh-muc/ao-quan-bao-ho/";
  }
  return "/sp/";
}

/**
 * The redirect table owns the legacy `/size/...` source and its filter target.
 * WordPress could encode the page either in the pathname or as `?paged=`;
 * the latter cannot be stored as a redirect source (queries are deliberately
 * excluded from `redirects.source_pattern`), so adapt only that page number
 * while keeping the redirect itself table-driven.
 */
function copyLegacySizePage(request: NextRequest, sourcePath: string, destination: URL): void {
  if (!/^\/(?:size)\/[^/]+\/?$/i.test(sourcePath)) return;
  if (destination.searchParams.has("page")) return;
  const paged = request.nextUrl.searchParams.get("paged");
  if (!paged || !/^[1-9]\d{0,2}$/.test(paged)) return;
  destination.searchParams.set("page", paged);
}

function redirectResponse(
  request: NextRequest,
  rule: RedirectLookup,
  currentPath: string,
  locale: "vi" | "en",
): NextResponse | null {
  if (rule.statusCode === 410) {
    const goneUrl = new URL("/seo/gone/", request.url);
    goneUrl.searchParams.set("locale", locale);
    goneUrl.searchParams.set("category", translatePath(goneCategoryPath(currentPath), locale));
    return NextResponse.rewrite(goneUrl, {
      status: 410,
      headers: { "X-Robots-Tag": "noindex, nofollow" },
    });
  }

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
  copyLegacySizePage(request, currentPath, destination);
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
    const cleared = clearRedirectCaches();
    return NextResponse.json({ cleared: true, ...cleared });
  }

  // Internal terminal SEO responses are rendered by an app route. Do not send
  // that rewrite back through locale routing or the redirect table.
  if (
    pathname === "/seo/gone"
    || pathname === "/seo/gone/"
    || pathname === "/seo/not-found"
    || pathname === "/seo/not-found/"
  ) {
    return NextResponse.next();
  }
  if (
    pathname.startsWith("/legacy/")
    || pathname.startsWith("/vi/legacy/")
    || pathname.startsWith("/en/legacy/")
    || pathname.startsWith("/vi/internal/")
    || pathname.startsWith("/en/internal/")
  ) {
    return NextResponse.next();
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
    const htmlRule = await lookupLegacyHtmlRedirect(htmlLookupPath);
    if (htmlRule) {
      const response = redirectResponse(request, htmlRule, htmlLookupPath, locale);
      if (response) return response;
    }
    const legacyProductPath = legacyProductRewritePath(pathname, locale);
    if (legacyProductPath) {
      const destination = new URL(legacyProductPath, request.url);
      return NextResponse.rewrite(destination);
    }
  }

  // Vietnamese is canonical without a prefix. Normalize /vi in one permanent
  // hop while retaining query parameters and hashes from the requested URL.
  if (pathname === "/vi" || pathname.startsWith("/vi/")) {
    const destination = request.nextUrl.clone();
    destination.pathname = translatePath(pathname, "vi").split(/[?#]/)[0];
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
    // English redirect sources are locale-specific and must be checked before
    // translating to the neutral Vietnamese registry key. Otherwise an English
    // alias can inherit a Vietnamese intermediate and add a second hop.
    const localeRule = locale === "en" ? await lookupRedirect(pathname) : null;
    const slashlessRule = localeRule ?? await lookupRedirect(
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

  // Prefer an exact /en source before the locale-neutral lookup. This is what
  // lets the redirect registry collapse English two-hop aliases directly to
  // their current English destination.
  const localeRule = locale === "en" ? await lookupRedirect(pathname) : null;
  const rule = localeRule ?? await lookupRedirect(viPathname);
  const isDefaultLocaleRoute = locale === "vi" && !hasExplicitLocalePrefix(pathname);
  if (!rule) {
    const brandSlug = brandSlugFromPath(pathname);
    if (brandSlug) {
      const brandExists = await lookupPublicBrandExists(brandSlug, locale);
      if (brandExists === false) {
        const notFoundUrl = new URL("/seo/not-found/", request.url);
        notFoundUrl.searchParams.set("locale", locale);
        notFoundUrl.searchParams.set("entity", "brand");
        return NextResponse.rewrite(notFoundUrl);
      }
    }
    const articleSlug = articleSlugFromPath(pathname);
    if (articleSlug) {
      const articleExists = await lookupPublicArticleExists(articleSlug, locale);
      if (articleExists === false) {
        const notFoundUrl = new URL("/seo/not-found/", request.url);
        notFoundUrl.searchParams.set("locale", locale);
        notFoundUrl.searchParams.set("entity", "article");
        return NextResponse.rewrite(notFoundUrl);
      }
    }
    if (legacyEnglishTarget) {
      const destination = request.nextUrl.clone();
      destination.pathname = legacyEnglishTarget;
      return NextResponse.redirect(destination, 301);
    }
    if (isDefaultLocaleRoute) return rewriteDefaultLocaleRequest(request);
    return handleI18nRequest(request);
  }

  return redirectResponse(request, rule, viPathname, locale)
    ?? (isDefaultLocaleRoute ? rewriteDefaultLocaleRequest(request) : handleI18nRequest(request));
}

export const config = {
  matcher: [
    // Locale routing only applies to document URLs. Public assets, media and
    // metadata files must retain their original paths instead of being rewritten
    // beneath /vi or /en.
    // `xml` giữ cho /sitemap.xml + /brand/favicon/browserconfig.xml; `ttf|otf|eot`
    // và `mp4|webm|mp3|wasm|mjs` là loại file tĩnh có thể thêm sau này (public/fonts
    // đã gỡ 2026-08-18 — toàn web dùng Arial hệ thống, không tự host font nào). Thiếu chúng thì next-intl viết lại đường dẫn xuống
    // /vi/... và file trả 404 (sitemap còn trả nhầm HTML) — đã đo 2026-08-06.
    "/((?!api|_next|_vercel|.*\\.(?:avif|css|eot|gif|ico|jpe?g|js|json|map|mjs|mp3|mp4|otf|pdf|png|svg|ttf|txt|wasm|webm|webmanifest|webp|woff2?|xml)$).*)",
  ],
};
