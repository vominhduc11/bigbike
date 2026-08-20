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
  // Only emit active permanent rows. All storefront redirects are deliberately
  // normalized to one 301 hop; 302/307 rows must be owned by the backend table
  // or removed from the legacy CSV instead of becoming a hidden second policy.
  return rows
    .filter((row) =>
      row.status === "active" &&
      ["301", "308"].includes(row.redirectType) &&
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
        statusCode: 301,
      };
    })
    .filter((item): item is { source: string; destination: string; statusCode: 301 } => Boolean(item));
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
      dynamic: 0,
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
      // Customer avatar hotlinked straight from Google/Facebook on OAuth login
      // (owner-approved exception 2026-08-07 to the MinIO-only media rule — see
      // BUSINESS_RULES.md MEDIA_RULE_005, CustomerOAuthService.backfillAvatar).
      // "**." wildcard covers every CDN subdomain depth each provider actually serves from.
      {
        protocol: "https",
        hostname: "**.googleusercontent.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "**.fbcdn.net",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "platform-lookaside.fbsbx.com",
        pathname: "/**",
      },
      // BigBike Assistant avatar hosted on the owner-provided Cloudinary asset.
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/daohufjec/image/upload/**",
      },
      // Dynamic: MinIO on any network IP configured via BIGBIKE_LEGACY_UPLOADS_BASE
      ...(dynamicMediaPattern ? [dynamicMediaPattern] : []),
    ],
  },
  async redirects() {
    return [
      // Canonical Vietnamese catalog URLs (CATEGORY_RULE_003).
      // Use an explicit statusCode because Next's `permanent: true` emits 308, not 301.
      {
        source: "/danh-muc-san-pham/",
        destination: "/sp/",
        statusCode: 301,
      },
      {
        source: "/danh-muc-san-pham",
        destination: "/sp/",
        statusCode: 301,
      },
      {
        source: "/danh-muc-san-pham.html",
        destination: "/sp/",
        statusCode: 301,
      },
      {
        source: "/danh-muc/",
        destination: "/sp/",
        statusCode: 301,
      },
      {
        source: "/danh-muc",
        destination: "/sp/",
        statusCode: 301,
      },
      {
        source: "/san-pham/",
        destination: "/sp/",
        statusCode: 301,
      },
      {
        source: "/san-pham",
        destination: "/sp/",
        statusCode: 301,
      },
      {
        source: "/categories/",
        destination: "/en/products/",
        statusCode: 301,
      },
      {
        source: "/categories",
        destination: "/en/products/",
        statusCode: 301,
      },
      // Redirect legacy/existing checkout paths to new order path
      {
        source: "/thanh-toan/",
        destination: "/dat-hang/",
        statusCode: 301,
      },
      {
        source: "/thanh-toan.html",
        destination: "/dat-hang/",
        statusCode: 301,
      },
      // /home.html → / is a true redirect (home.html was the WP default page slug,
      // not a canonical we want to preserve).
      {
        source: "/home.html",
        destination: "/",
        statusCode: 301,
      },
      {
        source: "/san-pham.html",
        destination: "/sp/",
        statusCode: 301,
      },
      // Các slug danh mục đổi tên khi migration đã chuyển hẳn sang bảng `redirects`
      // quản lý trong admin (2026-08-07) — 4 URL cũ × 2 biến thể (.html và không).
      // Luật viết cứng ở đây chạy TRƯỚC proxy nên luôn đè bảng admin: chủ shop sửa
      // trong admin mà không có tác dụng, hit_count đứng yên ở 0. Đừng thêm lại.
      // Lưu ý nếu sau này khôi phục docs/legacy/SEO_REDIRECT_MAP.csv: luật CSV chung
      // /{slug}.html→/{slug}/ sẽ lại đè bảng admin, phải xét lại thứ tự khi đó.
      // Legacy buying-guide URLs. Bộ hướng dẫn tĩnh hiện chỉ có 2 trang con
      // (size-mu, size-trang-phuc) — không có nội dung "mua hàng" riêng, nên mọi
      // biến thể mua-hàng cũ 301 về hub /huong-dan/; size-gang-tay cũ gộp vào
      // trang size trang phục (đã bao gồm găng tay). Sửa 404 legacy (AUD-012).
      // Must precede the generic /{slug}.html→category CSV rule.
      {
        source: "/huong-dan-mua-hang.html",
        destination: "/huong-dan/",
        statusCode: 301,
      },
      {
        source: "/huong-dan-mua-hang",
        destination: "/huong-dan/",
        statusCode: 301,
      },
      {
        source: "/huong-dan/mua-hang",
        destination: "/huong-dan/",
        statusCode: 301,
      },
      {
        source: "/huong-dan/size-gang-tay",
        destination: "/huong-dan/size-trang-phuc/",
        statusCode: 301,
      },
      // Canonical cũ trong static-pages.json trước 2026-07-15 trỏ các URL chưa từng
      // được build — 301 về route thực để không mất SEO legacy (AUD-031).
      {
        source: "/cach-do-size-dau",
        destination: "/huong-dan/size-mu/",
        statusCode: 301,
      },
      {
        source: "/cach-do-size-trang-phuc",
        destination: "/huong-dan/size-trang-phuc/",
        statusCode: 301,
      },
      {
        source: "/chinh-sach/bao-hanh",
        destination: "/chinh-sach/chinh-sach-bao-hanh/",
        statusCode: 301,
      },
      {
        source: "/chinh-sach/doi-tra",
        destination: "/chinh-sach/chinh-sach-doi-tra-hang/",
        statusCode: 301,
      },
      ...csvRedirectRules,
      // Legacy WP sitemap index → consolidated Next.js sitemap.
      {
        source: "/sitemap_index.xml",
        destination: "/sitemap.xml",
        statusCode: 301,
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
        // Hierarchical category URLs: /{parent}/{child}.html → /danh-muc/{child}/
        // (simplified; parent context not used by current category page)
        {
          source: "/:parent((?!sp/)[^/]+)/:child.html",
          destination: "/danh-muc/:child/",
        },
        // Catch-all for flat category URLs: /{cat}.html → /danh-muc/{cat}/
        // Must be last — specific rules above take precedence by ordering.
        {
          source: "/:slug.html",
          destination: "/danh-muc/:slug/",
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
        "frame-src https://www.google.com https://maps.google.com https://www.youtube-nocookie.com https://www.youtube.com https://www.tiktok.com https://www.facebook.com",
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
      //
      // PHẢI có cả 2 rule: `i18n/routing.ts` khai /preview/product và /preview/article
      // cho CẢ hai locale, và `localePrefix: "as-needed"` đặt bản tiếng Anh ở
      // /en/preview/*. Chỉ khai /preview/:path* thì bản EN không khớp rule nào —
      // đã đo 2026-08-06: /preview/product/ có X-Robots-Tag, /en/preview/product/
      // hoàn toàn không có header lẫn thẻ meta (trang là "use client" nên không
      // export generateMetadata được). Không vá bằng robots.txt: Google phải tải
      // được trang thì mới đọc được lệnh noindex (SEO_RULE_004).
      {
        source: "/preview/:path*",
        headers: previewHeaders,
      },
      {
        source: "/en/preview/:path*",
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
