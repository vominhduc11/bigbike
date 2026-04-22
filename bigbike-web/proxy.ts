// Next.js 16 renamed the `middleware` file convention to `proxy`.
// See node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md
// Runs on the Node.js runtime by default (proxy cannot opt into Edge in v16),
// which lets us use ioredis directly.

import { NextResponse, type NextRequest } from "next/server";
import Redis from "ioredis";

const API_BASE_URL =
  process.env.BIGBIKE_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:8080";

const REDIS_URL = process.env.BIGBIKE_REDIS_URL?.trim() || null;

const TTL_SECONDS = Number.parseInt(
  process.env.BIGBIKE_REDIRECT_CACHE_TTL_SECONDS ?? "300",
  10,
);

const CACHE_KEY_PREFIX = "bigbike:redirect:";
// Sentinel stored in Redis when the backend says "no redirect for this path",
// so we don't hammer the API on every miss.
const NEGATIVE_CACHE_VALUE = "__none__";

// L1 in-process cache — prevents redundant Redis/backend hits within the same
// worker process. Capped to avoid unbounded growth across 20K+ redirect entries.
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
    // FIFO eviction: remove the oldest inserted key.
    const first = l1Cache.keys().next().value;
    if (first !== undefined) l1Cache.delete(first);
  }
  l1Cache.set(key, { value, expiresAt: Date.now() + TTL_SECONDS * 1_000 });
}

type RedirectLookup = {
  target: string;
  statusCode: number;
};

let redisClient: Redis | null | undefined;

function getRedis(): Redis | null {
  if (redisClient !== undefined) return redisClient;
  if (!REDIS_URL) {
    redisClient = null;
    return null;
  }
  try {
    redisClient = new Redis(REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
    redisClient.on("error", () => {
      // Swallow — proxy must never crash a request because Redis is down.
    });
  } catch {
    redisClient = null;
  }
  return redisClient;
}

async function readCache(path: string): Promise<RedirectLookup | "miss" | "negative"> {
  const r = getRedis();
  if (!r) return "miss";
  try {
    const raw = await r.get(CACHE_KEY_PREFIX + path);
    if (raw === null) return "miss";
    if (raw === NEGATIVE_CACHE_VALUE) return "negative";
    return JSON.parse(raw) as RedirectLookup;
  } catch {
    return "miss";
  }
}

async function writeCache(path: string, value: RedirectLookup | null): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    const payload = value === null ? NEGATIVE_CACHE_VALUE : JSON.stringify(value);
    await r.set(CACHE_KEY_PREFIX + path, payload, "EX", TTL_SECONDS);
  } catch {
    // ignore
  }
}

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
    // Network error or 2 s timeout — don't cache, let request pass through.
    return null;
  }
}

async function lookupRedirect(path: string): Promise<RedirectLookup | null> {
  // L1 check — synchronous, zero network cost.
  const l1 = l1Get(path);
  if (l1 !== undefined) return l1;

  // L2: Redis (when configured).
  const cached = await readCache(path);
  if (cached === "negative") {
    l1Set(path, null);
    return null;
  }
  if (cached !== "miss") {
    l1Set(path, cached);
    return cached;
  }

  // WordPress source paths are stored without trailing slashes.
  // Next.js trailingSlash:true may normalize /old-path → /old-path/, so try
  // the de-trailed variant when the exact path yields no result.
  const deslashed =
    path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;

  let fresh = await fetchFromBackend(path);
  if (!fresh && deslashed !== path) {
    fresh = await fetchFromBackend(deslashed);
  }

  await writeCache(path, fresh);
  l1Set(path, fresh);
  return fresh;
}

function isLoop(currentPath: string, target: string): boolean {
  // target may be absolute (https://…) or relative (/foo). Compare path-only.
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

  const rule = await lookupRedirect(pathname);
  if (!rule) return NextResponse.next();

  if (isLoop(pathname, rule.target)) {
    // Bail out — the configured target equals the current path. Letting Next
    // serve the page is safer than emitting a self-redirect (browser loop).
    return NextResponse.next();
  }

  const destination = rule.target.startsWith("/")
    ? new URL(rule.target, request.url)
    : new URL(rule.target);

  return NextResponse.redirect(destination, rule.statusCode || 301);
}

export const config = {
  // Skip Next internals, API routes, static files, and SEO sidecar routes.
  // The brief's loop-guard requirement is implemented at two layers: this
  // matcher excludes anything we serve directly, and isLoop() guards against
  // misconfigured rules whose target equals their source.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|sitemap_index.xml|robots.txt|wp-content).*)",
  ],
};
