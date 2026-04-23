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

const REDIRECT_CSV_PATH = path.resolve(process.cwd(), "../docs/legacy/SEO_REDIRECT_MAP.csv");

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
  // Preserve rows are kept by route behavior + trailingSlash policy.
  // Only explicit redirect rows are emitted here; large legacy maps can be owned by CDN/nginx later.
  return rows
    .filter((row) =>
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

const LEGACY_UPLOADS_BASE =
  process.env.BIGBIKE_LEGACY_UPLOADS_BASE?.replace(/\/$/, "") ??
  "https://cdn.bigbike.vn/uploads";

const nextConfig: NextConfig = {
  output: "standalone",
  trailingSlash: true,
  async redirects() {
    return [
      ...csvRedirectRules,
      // Legacy WP sitemap index → consolidated Next.js sitemap.
      // Anchored exact match on the sitemap_index path so we don't accidentally
      // intercept any other /sitemap*.xml routes Next emits.
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
      // before Next's filesystem routing tries to match a page. The path
      // segment is intentionally narrow (`/wp-content/uploads/...`) so this
      // rule cannot capture other routes.
      beforeFiles: [
        {
          source: "/wp-content/uploads/:path*",
          destination: `${LEGACY_UPLOADS_BASE}/:path*`,
        },
      ],
      afterFiles: [],
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
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob: https:",
          "font-src 'self' data:",
          "connect-src 'self' https:",
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
