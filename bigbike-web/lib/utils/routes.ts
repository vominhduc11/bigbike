const SITE_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  process.env.BIGBIKE_SITE_URL?.trim() ||
  "https://bigbike.vn";

export function toProductPath(slug: string): string {
  return `/product/${slug}/`;
}

export function toProductListPath(): string {
  return "/san-pham/";
}

export function toCategoryPath(slug: string): string {
  return `/danh-muc-san-pham/${slug}/`;
}

export function toCategoryListPath(): string {
  return "/danh-muc-san-pham/";
}

export function toBrandPath(slug: string): string {
  return `/brands/${slug}/`;
}

export function toBrandListPath(): string {
  return "/brands/";
}

export function toArticlePath(slug: string): string {
  return `/tin-tuc/${slug}.html`;
}

export function toArticleListPath(): string {
  return "/tin-tuc/";
}

export function toPagePath(slug: string): string {
  return `/${slug}/`;
}

export function toHomePath(): string {
  return "/";
}

export function toCanonicalUrl(path: string): string {
  return new URL(path, SITE_ORIGIN).toString();
}

export function getSiteOrigin(): string {
  return SITE_ORIGIN;
}
