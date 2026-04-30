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

export function toCategoryListPath(): string {
  return "/danh-muc-san-pham/";
}

export function toCategoryPath(slug: string): string {
  return `/danh-muc-san-pham/${slug}/`;
}

export function toCategoryHierPath(childSlug: string): string {
  return `/danh-muc-san-pham/${childSlug}/`;
}

export function toBrandPath(slug: string): string {
  return `/brands/${slug}/`;
}

export function toBrandListPath(): string {
  return "/brands/";
}

export function toArticlePath(slug: string): string {
  return `/tin-tuc/${slug}/`;
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

export function toCartPath(): string {
  return "/gio-hang/";
}

export function toCheckoutPath(): string {
  return "/thanh-toan/";
}

export function toOrderConfirmPath(orderNumber: string, orderKey?: string): string {
  const params = new URLSearchParams({ so: orderNumber });
  if (orderKey) {
    params.set("key", orderKey);
  }
  return `/don-hang/xac-nhan?${params.toString()}`;
}

export function toOrderDetailPath(orderId: string): string {
  return `/tai-khoan/don-hang/${encodeURIComponent(orderId)}`;
}

export function toLoginPath(returnTo?: string): string {
  if (returnTo) return `/dang-nhap/?tiep=${encodeURIComponent(returnTo)}`;
  return "/dang-nhap/";
}

export function toForgotPasswordPath(token?: string): string {
  if (token) return `/quen-mat-khau/?token=${encodeURIComponent(token)}`;
  return "/quen-mat-khau/";
}

export function toRegisterPath(): string {
  return "/dang-ky/";
}

export function toAccountPath(): string {
  return "/tai-khoan/";
}

export function toOrderHistoryPath(): string {
  return "/tai-khoan/don-hang/";
}

export function toCanonicalUrl(path: string): string {
  return new URL(path, SITE_ORIGIN).toString();
}

export function getSiteOrigin(): string {
  return SITE_ORIGIN;
}
