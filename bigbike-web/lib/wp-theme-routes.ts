/**
 * Danh sách route đã port sang theme WordPress gốc (bigbike.vn).
 * Trên các route này, shell mặc định của bigbike-web (SiteHeader/SiteFooter)
 * được ẩn ở phía server để trang tự render shell WP — không nháy, không trùng.
 * Khi convert thêm template, thêm path vào đây.
 */
export const WP_THEME_ROUTES = new Set<string>([
  "/",
  "/san-pham",
  "/tin-tuc",
  "/tim-kiem",
  "/brands",
  // Cụm giao dịch đã port theme WP.
  "/gio-hang",
  "/thanh-toan",
  // Trang xác nhận đơn (endpoint order-received của checkout) — dùng khung checkout.
  "/don-hang/xac-nhan",
  // Cụm tài khoản — toàn bộ route con đã port theme WP (xem WpAccountShell);
  // route con động khớp qua prefix "/tai-khoan/" bên dưới.
  "/tai-khoan",
  // Cụm xác thực đã port theme WP (khung WpStaticShell, không hero).
  "/dang-nhap",
  "/dang-ky",
  "/quen-mat-khau",
  "/xac-nhan-email",
  // Nhóm trang nội dung tĩnh đã port (khung WpStaticShell).
  "/gioi-thieu",
  "/lien-he",
  "/bao-hanh",
  "/huong-dan",
]);

/** Prefix động (route có [slug]) đã port sang theme WP. */
export const WP_THEME_PREFIXES: string[] = [
  "/product/",
  "/danh-muc-san-pham/",
  "/brands/",
  "/tin-tuc/",
  "/chinh-sach/",
  "/huong-dan/",
  "/tai-khoan/",
];

/**
 * Route single-segment cấp cao GIỮ shell mặc định của bigbike-web (không port WP).
 * Mọi single-segment khác chưa khớp route riêng nào sẽ rơi vào catch-all
 * `app/[slug]` — trang CMS chung đã port theme WP — nên mặc định coi là route WP
 * để ẩn shell mặc định. Hiện không còn route nào dùng shell mặc định;
 * set giữ lại làm cơ chế loại trừ cho tương lai.
 */
const NON_WP_TOP_LEVEL = new Set<string>([]);

export function isWpThemeRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  // Bỏ trailing slash (trừ root) để khớp ổn định.
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (WP_THEME_ROUTES.has(clean || "/")) return true;
  // Khớp cả sub-path động (vd /brands/honda, /chinh-sach/bao-hanh).
  if (WP_THEME_PREFIXES.some((p) => clean.startsWith(p))) return true;
  // Catch-all `app/[slug]`: một segment cấp cao chưa khớp route riêng → trang CMS
  // chung dùng khung WP, trừ các route giữ shell mặc định ở trên.
  const segments = clean.split("/").filter(Boolean);
  if (segments.length === 1 && !NON_WP_TOP_LEVEL.has(segments[0])) {
    return true;
  }
  return false;
}
