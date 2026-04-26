import fs from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

type SeoRedirectRow = {
  sourcePattern: string;
  targetPattern: string;
  redirectType: string;
  status: string;
  notes: string;
};

const REDIRECT_CSV_PATH = path.resolve(process.cwd(), "docs/legacy/SEO_REDIRECT_MAP.csv");

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
const LEGACY_UPLOADS_BASE =
  process.env.BIGBIKE_LEGACY_UPLOADS_BASE?.replace(/\/$/, "") ??
  "https://cdn.bigbike.vn/uploads";

// BIGBIKE_MEDIA_INTERNAL_URL — used for the Next.js server-side rewrite destination.
// When Next.js runs inside Docker it must reach MinIO via the internal Docker network
// (minio:9000), NOT localhost:9000 which is unreachable from inside the container.
// Falls back to BIGBIKE_LEGACY_UPLOADS_BASE so local `next dev` still works unchanged.
const MEDIA_INTERNAL_BASE =
  process.env.BIGBIKE_MEDIA_INTERNAL_URL?.replace(/\/$/, "") ??
  LEGACY_UPLOADS_BASE;

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


const nextConfig: NextConfig = {
  output: "standalone",
  trailingSlash: true,
  async redirects() {
    return [
      // /home.html → / is a true redirect (home.html was the WP default page slug,
      // not a canonical we want to preserve).
      {
        source: "/home.html",
        destination: "/",
        permanent: true,
      },
      // /san-pham.html → danh-muc-san-pham.html keeps one extra alias working.
      {
        source: "/san-pham.html",
        destination: "/danh-muc-san-pham.html",
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
          source: "/thanh-toan.html",
          destination: "/thanh-toan/",
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
        {
          source: "/huong-dan-mua-hang.html",
          destination: "/huong-dan-mua-hang/",
        },
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
    const securityHeaders = [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      {
        key: "Strict-Transport-Security",
        value: "max-age=31536000; includeSubDomains; preload",
      },
      {
        key: "Content-Security-Policy",
        value: [
          "default-src 'self'",
          // Next.js inline scripts (nonces are ideal but require middleware; this is a pragmatic baseline)
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com",
          "style-src 'self' 'unsafe-inline'",
          `img-src 'self' data: blob: https:${MEDIA_ORIGIN ? " " + MEDIA_ORIGIN : ""}`,
          "font-src 'self' data:",
          `connect-src 'self' https: ${API_ORIGIN} https://www.google-analytics.com`,
          "frame-src https://www.google.com https://maps.google.com",
          "frame-ancestors 'none'",
          "base-uri 'self'",
          "form-action 'self'",
        ].join("; "),
      },
    ];

    return [
      // Apply security headers to all routes
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      // Noindex for specific legacy routes from CSV
      ...csvNoIndexHeaders,
    ];
  },
};

export default nextConfig;
