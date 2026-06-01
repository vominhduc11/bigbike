/**
 * Shared helpers for resolving legacy WordPress upload URLs, used by the news
 * (`/tin-tuc`) listing and article pages. Extracted verbatim from the two pages
 * (the definitions were byte-for-byte identical) so output is unchanged.
 *
 * Distinct from `resolveMediaUrl` in `lib/utils/format.ts`: that one strips a
 * URL down to a same-origin proxy path, whereas these resolve a raw value to an
 * absolute `https://bigbike.vn/wp-content/uploads/...` URL.
 */
const BIGBIKE_UPLOADS_BASE = "https://bigbike.vn/wp-content/uploads/";
const LEGACY_CDN_PREFIX = "https://cdn.bigbike.vn/uploads/";
const WP_UPLOADS_PATH = "/wp-content/uploads/";
const MINIO_UPLOADS_SUBPATH = "/wp-uploads/";

export function resolveWpUploadUrl(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw) {
    return null;
  }

  if (raw.startsWith(LEGACY_CDN_PREFIX)) {
    return normalizeKnownWpUploadUrl(`${BIGBIKE_UPLOADS_BASE}${raw.slice(LEGACY_CDN_PREFIX.length)}`);
  }

  if (raw.startsWith(WP_UPLOADS_PATH)) {
    return normalizeKnownWpUploadUrl(`https://bigbike.vn${raw}`);
  }

  if (/^https:\/\/(?:www\.)?bigbike\.vn\/wp-content\/uploads\//.test(raw)) {
    return normalizeKnownWpUploadUrl(raw);
  }

  if (raw.startsWith("http") && raw.includes(MINIO_UPLOADS_SUBPATH)) {
    const idx = raw.indexOf(MINIO_UPLOADS_SUBPATH);
    return normalizeKnownWpUploadUrl(`${BIGBIKE_UPLOADS_BASE}${raw.slice(idx + MINIO_UPLOADS_SUBPATH.length)}`);
  }

  return raw;
}

function normalizeKnownWpUploadUrl(url: string): string {
  return url.replace(
    "/wp-content/uploads/2026/03/shop-mu-bao-hiem-gan-day-thumbnail.jpg",
    "/wp-content/uploads/2026/03/shop-non-bao-hiem-gan-day-thumbnail.jpg",
  );
}

export function makeSlugThumbnailFallback(value: string | null | undefined, slug: string): string | null {
  const resolved = resolveWpUploadUrl(value);
  if (!resolved || !slug) {
    return null;
  }

  const match = resolved.match(/^(https:\/\/bigbike\.vn\/wp-content\/uploads\/\d{4}\/\d{2}\/)([^/?#]+)(\.[a-z0-9]+)([?#].*)?$/i);
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
