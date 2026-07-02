import fs from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import createNextIntlPlugin from "next-intl/plugin";
import withBundleAnalyzerFactory from "@next/bundle-analyzer";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");
// ANALYZE=true npm run analyze — opens an interactive treemap of the client/server
// bundles after `next build`. No-op (identity wrap) when the env var is unset, so
// normal dev/build/deploy are unaffected.
const withBundleAnalyzer = withBundleAnalyzerFactory({
  enabled: process.env.ANALYZE === "true",
});

type SeoRedirectRow = {
  sourcePattern: string;
  targetPattern: string;
  redirectType: string;
  status: string;
  notes: string;
};

const REDIRECT_CSV_PATH = path.resolve(process.cwd(), "docs/legacy/SEO_REDIRECT_MAP.csv");

function normalizeBaseUrl(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    return fallback;
  }

  return trimmed.replace(/\/$/, "");
}

function parseCsvRows(): SeoRedirectRow[] {
  if (!fs.existsSync(REDIRECT_CSV_PATH)) {
    return [];
  }

  const raw = fs.readFileSync(REDIRECT_CSV_PATH, "utf8");
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length <= 1) {
    return [];
  }

  return lines.slice(1).map((line) => {
    const [sourcePattern, targetPattern, redirectType, status, ...notesParts] = line.split(",");
    return {
      sourcePattern: sourcePattern?.trim() ?? "",
      targetPattern: targetPattern?.trim() ?? "",
      redirectType: redirectType?.trim().toLowerCase() ?? "",
      status: status?.trim().toLowerCase() ?? "",
      notes: notesParts.join(",").trim(),
    };
  });
}

function toRouteParamName(raw: string): string {
  return raw
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, char: string) => char.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, "");
}

function toNextPath(pattern: string): string | null {
  if (!pattern || pattern.includes("?")) {
    return null;
  }

  return pattern.replace(/\{([^}]+)\}/g, (_, param: string) => `:${toRouteParamName(param)}`);
}

function buildRedirectRules(rows: SeoRedirectRow[]) {
  // Only emit rows with status=active. Rows marked rewrite/removed/inactive are
  // handled by afterFiles rewrites or no longer needed.
  return rows
    .filter((row) =>
      row.status === "active" &&
      ["301", "302", "307", "308"].includes(row.redirectType) &&
      row.sourcePattern !== row.targetPattern,
    )
    .map((row) => {
      const source = toNextPath(row.sourcePattern);
      const destination = toNextPath(row.targetPattern);
      if (!source || !destination) {
        return null;
      }

      return {
        source,
        destination,
        permanent: row.redirectType === "301" || row.redirectType === "308",
      };
    })
    .filter((item): item is { source: string; destination: string; permanent: boolean } => Boolean(item));
}

function buildNoIndexHeaders(rows: SeoRedirectRow[]) {
  return rows
    .filter((row) => row.redirectType === "noindex" || row.status === "noindex")
    .map((row) => {
      const source = toNextPath(row.sourcePattern);
      if (!source) {
        return null;
      }

      return {
        source,
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow",
          },
        ],
      };
    })
    .filter((item): item is { source: string; headers: Array<{ key: string; value: string }> } => Boolean(item));
}

const redirectRows = parseCsvRows();
const csvRedirectRules = buildRedirectRules(redirectRows);
const csvNoIndexHeaders = buildNoIndexHeaders(redirectRows);

// BIGBIKE_LEGACY_UPLOADS_BASE — used for CSP img-src at build time (browser-visible origin).
// In Docker Compose this is baked as http://localhost:9000/bigbike-media/wp-uploads so
// the browser's CSP allows loading images from the host-mapped MinIO port.
// The "https://cdn.bigbike.vn/uploads" fallback below only matters if the env var is
// unset — cdn.bigbike.vn is NOT a real CDN, it's the old WordPress host (verified live:
// no CDN response headers, plain nginx→MinIO passthrough). The real media domain is
// media.bigbike.vn (BIGBIKE_MEDIA_PUBLIC_BASE_URL). This string is still meaningful as a
// prefix match, though: LEGACY_CDN_PREFIX in lib/utils/format.ts / wp-media.ts rewrites
// old cdn.bigbike.vn URLs still stored in migrated product/article content to the real
// media host — do not delete without re-checking those still find matches.
const LEGACY_UPLOADS_BASE = normalizeBaseUrl(
  process.env.BIGBIKE_LEGACY_UPLOADS_BASE,
  "https://cdn.bigbike.vn/uploads",
);

// BIGBIKE_MEDIA_INTERNAL_URL — used for the Next.js server-side rewrite destination.
// When Next.js runs inside Docker it must reach MinIO via the internal Docker network
// (minio:9000), NOT localhost:9000 which is unreachable from inside the container.
// Falls back to BIGBIKE_LEGACY_UPLOADS_BASE so local `next dev` still works unchanged.
const MEDIA_INTERNAL_BASE = normalizeBaseUrl(
  process.env.BIGBIKE_MEDIA_INTERNAL_URL,
  LEGACY_UPLOADS_BASE,
);

// BIGBIKE_MEDIA_BUCKET_URL — bucket root URL (no /wp-uploads suffix) used for the
// /media/* rewrite that serves both new uploads (uploads/…) and migration files
// (wp-uploads/…) from the same MinIO bucket.
// Derived automatically by stripping /wp-uploads from MEDIA_INTERNAL_BASE when unset.
const MEDIA_BUCKET_INTERNAL_BASE = normalizeBaseUrl(
  process.env.BIGBIKE_MEDIA_BUCKET_URL,
  MEDIA_INTERNAL_BASE.endsWith("/wp-uploads")
    ? MEDIA_INTERNAL_BASE.slice(0, -"/wp-uploads".length)
    : "http://localhost:9000/bigbike-media",
);

// Extract API origin so CSP allows backend calls in any environment
// (http://localhost:8080 in dev, https://api.bigbike.vn in prod)
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";
const API_ORIGIN = (() => {
  try { return new URL(API_BASE).origin; } catch { return "http://localhost:8080"; }
})();

// Extract media origin for CSP img-src.
// In dev this resolves to http://localhost:9000 (MinIO); in prod CDN is https: so already covered.
const MEDIA_ORIGIN = (() => {
  try { return new URL(LEGACY_UPLOADS_BASE).origin; } catch { return ""; }
})();

// Dynamic next/image remotePattern from BIGBIKE_LEGACY_UPLOADS_BASE.
// Needed when MinIO runs on a network IP (e.g. 103.1.236.148) instead of localhost.
// Returns null when the hostname is localhost or https (already covered by static entries).
const dynamicMediaPattern = (() => {
  try {
    const parsed = new URL(LEGACY_UPLOADS_BASE);
    if (parsed.hostname === "localhost" || parsed.protocol === "https:") return null;
    return {
      protocol: parsed.protocol.replace(/:$/, "") as "http" | "https",
      hostname: parsed.hostname,
      ...(parsed.port ? { port: parsed.port } : {}),
      pathname: "/**",
    };
  } catch {
    return null;
  }
})();


const nextConfig: NextConfig = {
  output: "standalone",
  trailingSlash: true,
  // Keep legacy WordPress `.html` URLs from being normalized before rewrites.
  // Proxy below still normalizes extensionless routes to trailing slash.
  skipTrailingSlashRedirect: true,
  // Client router cache: keep static segments 3 min, dynamic 30 s.
  // Avoids full server roundtrip when navigating back to a recently visited page.
  experimental: {
    staleTimes: {
      static: 180,
      dynamic: 30,
    },
  },
  logging: {
    fetches: {
      fullUrl: process.env.NODE_ENV === "development",
    },
  },
  images: {
    remotePatterns: [
      // cdn.bigbike.vn is legacy (old WordPress host, not a real CDN — see
      // LEGACY_UPLOADS_BASE comment above). Kept as an allowlist entry so next/image
      // doesn't reject any migrated content that still embeds this old URL directly;
      // most such URLs are rewritten to media.bigbike.vn before reaching next/image
      // (LEGACY_CDN_PREFIX in lib/utils/format.ts / wp-media.ts), but this is a
      // zero-cost fallback for anything that isn't.
      {
        protocol: "https",
        hostname: "cdn.bigbike.vn",
        pathname: "/uploads/**",
      },
      // MinIO dev — reachable at localhost:9000 during local development
      {
        protocol: "http",
        hostname: "localhost",
        port: "9000",
        pathname: "/**",
      },
      // YouTube auto-thumbnails used by HomeVideoCarousel when no custom thumbnail is set
      {
        protocol: "https",
        hostname: "img.youtube.com",
        pathname: "/vi/**",
      },
      // Dynamic: MinIO on any network IP configured via BIGBIKE_LEGACY_UPLOADS_BASE
      ...(dynamicMediaPattern ? [dynamicMediaPattern] : []),
    ],
  },
  async redirects() {
    return [
      // Redirect legacy/existing checkout paths to new order path
      {
        source: "/thanh-toan/",
        destination: "/dat-hang/",
        permanent: true,
      },
      {
        source: "/thanh-toan.html",
        destination: "/dat-hang/",
        permanent: true,
      },
      // /home.html → / is a true redirect (home.html was the WP default page slug,
      // not a canonical we want to preserve).
      {
        source: "/home.html",
        destination: "/",
        permanent: true,
      },
      {
        source: "/san-pham.html",
        destination: "/san-pham/",
        permanent: true,
      },
      // Category slugs renamed in migration — must precede the generic /{slug}.html→/{slug}/ CSV rule.
      {
        source: "/mu-bao-hiem.html",
        destination: "/danh-muc-san-pham/non-bao-hiem-moto/",
        permanent: true,
      },
      {
        source: "/mu-bao-hiem",
        destination: "/danh-muc-san-pham/non-bao-hiem-moto/",
        permanent: true,
      },
      {
        source: "/ao-quan-bao-ho.html",
        destination: "/danh-muc-san-pham/quan-ao-bao-ho-moto/",
        permanent: true,
      },
      {
        source: "/ao-quan-bao-ho",
        destination: "/danh-muc-san-pham/quan-ao-bao-ho-moto/",
        permanent: true,
      },
      {
        source: "/phu-kien-khac.html",
        destination: "/san-pham/",
        permanent: true,
      },
      {
        source: "/phu-kien-khac",
        destination: "/san-pham/",
        permanent: true,
      },
      {
        source: "/san-pham-khuyen-mai.html",
        destination: "/san-pham/",
        permanent: true,
      },
      {
        source: "/san-pham-khuyen-mai",
        destination: "/san-pham/",
        permanent: true,
      },
      // Legacy standalone buying-guide page merged into the admin-managed guide builder.
      // /huong-dan-mua-hang now 301s to its canonical guide sub-route /huong-dan/mua-hang/.
      // Must precede the generic /{slug}.html→category CSV rule.
      {
        source: "/huong-dan-mua-hang.html",
        destination: "/huong-dan/mua-hang/",
        permanent: true,
      },
      {
        source: "/huong-dan-mua-hang",
        destination: "/huong-dan/mua-hang/",
        permanent: true,
      },
      ...csvRedirectRules,
      // Legacy WP sitemap index → consolidated Next.js sitemap.
      {
        source: "/sitemap_index.xml",
        destination: "/sitemap.xml",
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return {
      // beforeFiles ensures legacy upload URLs are served from the CDN/MinIO
      // before Next's filesystem routing tries to match a page.
      beforeFiles: [
        // New relative media URLs (/media/wp-uploads/… and /media/uploads/…)
        { source: "/media/:path*", destination: `${MEDIA_BUCKET_INTERNAL_BASE}/:path*` },
        {
          source: "/wp-content/uploads/:path*",
          destination: `${MEDIA_INTERNAL_BASE}/:path*`,
        },
      ],
      // afterFiles: checked after pages/public files but before dynamic routes.
      // These serve WordPress canonical .html URLs from existing Next.js app routes
      // without redirecting, so .html remains the canonical URL.
      afterFiles: [
        // Products: /sp/{slug}.html → /product/{slug}/
        {
          source: "/sp/:slug.html",
          destination: "/product/:slug/",
        },
        // Brands: /brand/{slug}.html → /brands/{slug}/
        {
          source: "/brand/:slug.html",
          destination: "/brands/:slug/",
        },
        // Articles: /tin-tuc/{slug}.html → /tin-tuc/{slug}/
        {
          source: "/tin-tuc/:slug.html",
          destination: "/tin-tuc/:slug/",
        },
        // Shop listing: /danh-muc-san-pham.html → /san-pham/
        {
          source: "/danh-muc-san-pham.html",
          destination: "/san-pham/",
        },
        // Known static page .html → internal trailing-slash routes
        {
          source: "/gio-hang.html",
          destination: "/gio-hang/",
        },
        {
          source: "/dat-hang.html",
          destination: "/dat-hang/",
        },
        {
          source: "/dang-nhap.html",
          destination: "/dang-nhap/",
        },
        {
          source: "/dang-ky.html",
          destination: "/dang-ky/",
        },
        {
          source: "/quen-mat-khau.html",
          destination: "/quen-mat-khau/",
        },
        {
          source: "/tai-khoan.html",
          destination: "/tai-khoan/",
        },
        {
          source: "/gioi-thieu.html",
          destination: "/gioi-thieu/",
        },
        {
          source: "/huong-dan.html",
          destination: "/huong-dan/",
        },
        // /huong-dan-mua-hang.html is handled by a 301 redirect (see redirects()) to the
        // canonical guide sub-route — no rewrite needed here.
        {
          source: "/lien-he.html",
          destination: "/lien-he/",
        },
        // Hierarchical category URLs: /{parent}/{child}.html → /danh-muc-san-pham/{child}/
        // (simplified; parent context not used by current category page)
        {
          source: "/:parent/:child.html",
          destination: "/danh-muc-san-pham/:child/",
        },
        // Catch-all for flat category URLs: /{cat}.html → /danh-muc-san-pham/{cat}/
        // Must be last — specific rules above take precedence by ordering.
        {
          source: "/:slug.html",
          destination: "/danh-muc-san-pham/:slug/",
        },
      ],
      fallback: [],
    };
  },
  async headers() {
    // CSP dựng theo frame-ancestors truyền vào, để route /preview/* (nhúng iframe
    // trong app admin khác origin) nới được frame-ancestors trong khi mọi route
    // khác vẫn 'none'.
    const buildCsp = (frameAncestors: string) =>
      [
        "default-src 'self'",
        // Next.js inline scripts (nonces are ideal but require middleware; this is a pragmatic baseline)
        // YouTube IFrame API (www.youtube.com/iframe_api + widget từ s.ytimg.com) để điều khiển
        // play/pause/ended của video sản phẩm — KHÔNG có 2 origin này thì script bị CSP chặn,
        // dải ảnh không biết video đang chạy nên vẫn tự nhảy slide. frame-src đã cho phép nhúng iframe.
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://www.googletagmanager.com https://www.youtube.com https://s.ytimg.com",
        "worker-src 'self' blob:",
        "style-src 'self' 'unsafe-inline'",
        `img-src 'self' data: blob: https:${MEDIA_ORIGIN ? " " + MEDIA_ORIGIN : ""}`,
        `media-src 'self' blob: https:${MEDIA_ORIGIN ? " " + MEDIA_ORIGIN : ""}`,
        "font-src 'self' data:",
        `connect-src 'self' https: ${API_ORIGIN} https://www.google-analytics.com`,
        "frame-src https://www.google.com https://maps.google.com https://www.youtube-nocookie.com https://www.youtube.com",
        `frame-ancestors ${frameAncestors}`,
        "base-uri 'self'",
        "form-action 'self'",
      ].join("; ");

    // Chống clickjacking bằng CSP `frame-ancestors`. Đã bỏ X-Frame-Options vì nó
    // không cho phép allow theo origin cụ thể (chỉ DENY/SAMEORIGIN) nên không dùng
    // được cho live preview nhúng từ admin; CSP frame-ancestors là cách hiện đại
    // và được Next khuyến nghị thay thế X-Frame-Options.
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      {
        key: "Strict-Transport-Security",
        value: "max-age=31536000; includeSubDomains; preload",
      },
      { key: "Content-Security-Policy", value: buildCsp("'none'") },
    ];

    // Live preview: route /preview/* được app admin (origin khác) nhúng iframe. Cho
    // đúng origin admin làm frame-ancestor; route này đặt SAU rule global nên CSP
    // của nó override cho /preview/* (Next: header key trùng thì giá trị sau thắng).
    // Kèm noindex để bản nháp không bị index.
    const adminOrigin = (process.env.NEXT_PUBLIC_ADMIN_ORIGIN ?? "").trim().replace(/\/$/, "");
    const previewHeaders = [
      {
        key: "Content-Security-Policy",
        value: buildCsp(`'self'${adminOrigin ? " " + adminOrigin : ""}`),
      },
      { key: "X-Robots-Tag", value: "noindex, nofollow" },
    ];

    return [
      // Apply security headers to all routes
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      // Live-preview iframe routes — relax frame-ancestors to the admin origin only.
      {
        source: "/preview/:path*",
        headers: previewHeaders,
      },
      // Noindex for specific legacy routes from CSV
      ...csvNoIndexHeaders,
    ];
  },
};

export default withSentryConfig(withBundleAnalyzer(withNextIntl(nextConfig)), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Upload source maps trong CI/production, tắt khi dev để giữ build nhanh
  silent: true,
  widenClientFileUpload: true,
  disableLogger: true,
  automaticVercelMonitors: false,

  // Tắt toàn bộ Sentry build plugin nếu không có DSN (môi trường dev)
  ...(!(process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN) && {
    dryRun: true,
  }),
});
