const SITE_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  process.env.BIGBIKE_SITE_URL?.trim() ||
  "https://bigbike.vn";

export function toProductPath(slug: string): string {
  return `/sp/${slug}.html`;
}

export function toProductListPath(): string {
  return "/danh-muc-san-pham.html";
}

export function toCategoryPath(slug: string): string {
  return `/${slug}.html`;
}

export function toCategoryHierPath(parentSlug: string, childSlug: string): string {
  return `/${parentSlug}/${childSlug}.html`;
}

export function toBrandPath(slug: string): string {
  return `/brand/${slug}.html`;
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
  return `/${slug}.html`;
}

export function toHomePath(): string {
  return "/";
}

export function toCartPath(): string {
  return "/gio-hang.html";
}

export function toCheckoutPath(): string {
  return "/thanh-toan.html";
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
  if (returnTo) return `/dang-nhap.html?tiep=${encodeURIComponent(returnTo)}`;
  return "/dang-nhap.html";
}

export function toForgotPasswordPath(token?: string): string {
  if (token) return `/quen-mat-khau.html?token=${encodeURIComponent(token)}`;
  return "/quen-mat-khau.html";
}

export function toRegisterPath(): string {
  return "/dang-ky.html";
}

export function toAccountPath(): string {
  return "/tai-khoan.html";
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
