/**
 * Public route catalog for the bigbike-web QA sweep. All paths use the trailing
 * slash the app enforces (next.config `trailingSlash: true`). Deep-link slugs are
 * real values harvested from the live sitemap (2026-05); update if the catalog drifts.
 */
export type RouteDef = {
  path: string;
  name: string;
  group: "home" | "catalog" | "content" | "commerce" | "search" | "auth" | "account";
  kind: "static" | "data";
  hasForm?: boolean;
};

export const PUBLIC_ROUTES: RouteDef[] = [
  { path: "/", name: "Trang chủ", group: "home", kind: "data" },
  { path: "/sp/", name: "Danh sách sản phẩm (PLP)", group: "catalog", kind: "data" },
  { path: "/brands/", name: "Thương hiệu", group: "catalog", kind: "data" },
  { path: "/tin-tuc/", name: "Tin tức", group: "content", kind: "data" },
  { path: "/gioi-thieu/", name: "Giới thiệu", group: "content", kind: "static" },
  { path: "/lien-he/", name: "Liên hệ", group: "content", kind: "static", hasForm: true },
  { path: "/huong-dan/", name: "Hướng dẫn", group: "content", kind: "static" },
  { path: "/huong-dan/size-mu/", name: "Hướng dẫn size mũ", group: "content", kind: "static" },
  { path: "/huong-dan/size-trang-phuc/", name: "Hướng dẫn size trang phục", group: "content", kind: "static" },
  { path: "/gio-hang/", name: "Giỏ hàng", group: "commerce", kind: "data" },
  { path: "/tim-kiem/", name: "Tìm kiếm", group: "search", kind: "data" },
  { path: "/dang-nhap/", name: "Đăng nhập", group: "auth", kind: "static", hasForm: true },
  { path: "/dang-ky/", name: "Đăng ký", group: "auth", kind: "static", hasForm: true },
  { path: "/quen-mat-khau/", name: "Quên mật khẩu", group: "auth", kind: "static", hasForm: true },
];

/** Real deep-link slugs (harvested from live sitemap / listing pages). */
export const SAMPLE = {
  product: "/product/balo-phuot-givi-rbp03/",
  category: "/danh-muc/ao-quan-adventure/",
  brand: "/brands/alpinestars/",
  news: "/tin-tuc/cach-giat-giay-bao-ho/",
  policy: "/chinh-sach/chinh-sach-doi-tra-hang/",
} as const;

export const DYNAMIC_ROUTES: RouteDef[] = [
  { path: SAMPLE.product, name: "Chi tiết sản phẩm (PDP)", group: "catalog", kind: "data" },
  { path: SAMPLE.category, name: "Danh mục chi tiết", group: "catalog", kind: "data" },
  { path: SAMPLE.brand, name: "Thương hiệu chi tiết", group: "catalog", kind: "data" },
  { path: SAMPLE.news, name: "Bài viết tin tức", group: "content", kind: "data" },
  { path: SAMPLE.policy, name: "Chính sách", group: "content", kind: "static" },
];

/** Account routes require auth — a guest should be redirected to /dang-nhap, never error. */
export const ACCOUNT_ROUTES: RouteDef[] = [
  { path: "/tai-khoan/", name: "Tài khoản", group: "account", kind: "data" },
  { path: "/tai-khoan/don-hang/", name: "Đơn hàng của tôi", group: "account", kind: "data" },
];

export const ALL_PUBLIC: RouteDef[] = [...PUBLIC_ROUTES, ...DYNAMIC_ROUTES];

/** Find the first anchor on a listing page whose href matches a pattern (runtime slug discovery). */
export async function discoverFirstHref(
  page: import("@playwright/test").Page,
  pattern: RegExp,
): Promise<string | null> {
  const hrefs = await page.locator("a[href]").evaluateAll((els) =>
    (els as HTMLAnchorElement[]).map((a) => a.getAttribute("href") || ""),
  );
  const match = hrefs.find((h) => pattern.test(h));
  if (!match) return null;
  try {
    return new URL(match, page.url()).pathname;
  } catch {
    return match;
  }
}
