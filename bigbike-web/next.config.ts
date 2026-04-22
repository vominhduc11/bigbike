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

const nextConfig: NextConfig = {
  output: "standalone",
  trailingSlash: true,
  async redirects() {
    return csvRedirectRules;
  },
  async headers() {
    return csvNoIndexHeaders;
  },
};

export default nextConfig;
