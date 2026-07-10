/**
 * Shared helpers for resolving legacy WordPress upload URLs, used by the news
 * (`/tin-tuc`) listing and article pages. Extracted verbatim from the two pages
 * (the definitions were byte-for-byte identical) so output is unchanged.
 *
 * Resolves raw values to same-origin upload paths so legacy/news images go
 * through the local rewrite/proxy instead of hotlinking bigbike.vn.
 */
const WP_UPLOADS_BASE = "/wp-content/uploads/";
const LEGACY_CDN_PREFIX = "https://cdn.bigbike.vn/uploads/";
const WP_UPLOADS_PATH = "/wp-content/uploads/";
const MEDIA_PROXY_UPLOADS_PATH = "/media-proxy/wp-uploads/";
const MINIO_UPLOADS_SUBPATH = "/wp-uploads/";

export function resolveWpUploadUrl(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw) {
    return null;
  }

  if (raw.startsWith(LEGACY_CDN_PREFIX)) {
    return `${WP_UPLOADS_BASE}${raw.slice(LEGACY_CDN_PREFIX.length)}`;
  }

  if (raw.startsWith(WP_UPLOADS_PATH)) {
    return raw;
  }

  if (raw.startsWith(MEDIA_PROXY_UPLOADS_PATH)) {
    return `${WP_UPLOADS_BASE}${raw.slice(MEDIA_PROXY_UPLOADS_PATH.length)}`;
  }

  if (/^https?:\/\/(?:www\.)?bigbike\.vn\/wp-content\/uploads\//.test(raw)) {
    const parsed = new URL(raw);
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  }

  if (raw.startsWith("http") && raw.includes(MINIO_UPLOADS_SUBPATH)) {
    const idx = raw.indexOf(MINIO_UPLOADS_SUBPATH);
    return `${WP_UPLOADS_BASE}${raw.slice(idx + MINIO_UPLOADS_SUBPATH.length)}`;
  }

  return raw;
}

export function makeSlugThumbnailFallback(value: string | null | undefined, slug: string): string | null {
  const resolved = resolveWpUploadUrl(value);
  if (!resolved || !slug) {
    return null;
  }

  const match = resolved.match(/^(\/wp-content\/uploads\/\d{4}\/\d{2}\/)([^/?#]+)(\.[a-z0-9]+)([?#].*)?$/i);
  if (!match) {
    return null;
  }

  const [, basePath, fileName, extension] = match;
  const fallbackName = `${slug}-thumbnail`;
  if (fileName === fallbackName) {
    return null;
  }

  return `${basePath}${fallbackName}${extension}`;
}
