"use client";

import Link from "@/i18n/StorefrontLink";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Home, ShoppingCart, User } from "lucide-react";
import { useHeaderUi } from "@/components/layout/HeaderUiContext";
import { useCart } from "@/lib/cart-context";
import { cn } from "@/lib/utils";
import { isAuthRoute, toAccountPath, toHomePath, translatePath } from "@/lib/utils/routes";
import type { Locale } from "@/i18n/locale";

function isHomePath(pathname: string) {
  return pathname === "/" || pathname === "" || pathname === "/en" || pathname === "/en/";
}

// Mobile-only bottom tab nav (≤767). .bb-bottom-nav is KEPT as a bare marker so the
// two parent-state slide-out rules (html[data-bb-header-panel] / body:has(.bb-pdp-
// sticky-cta.is-visible)) and the transition they animate still apply; everything
// else is inlined. Colors resolve the dark→light reskin to the last-effective layer:
// bg-surface-dark, mobile-shell-border, text-inverse-muted, brand-on-dark (active).
const labelCls =
  "max-w-full overflow-hidden text-ellipsis whitespace-nowrap font-cta text-b5-label uppercase leading-none";

function tabClass(active: boolean) {
  return cn(
    "relative flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 px-1 [flex:1_1_0] " +
      "border-none bg-transparent cursor-pointer touch-manipulation font-cta tracking-normal " +
      // `!` defeats the legacy unlayered legacy theme `a{color:#007bff}` that otherwise
      // paints every tab bootstrap-blue and erases the active/inactive distinction.
      "text-white/50! transition-colors duration-150",
    active && "text-[color:var(--bb-brand-primary-on-dark)]!",
  );
}

function ActiveBar() {
  return <span className="absolute left-1/2 top-0 h-0.5 w-6 -translate-x-1/2 bg-[color:var(--bb-brand-primary-on-dark)]" />;
}

export function MobileBottomNav() {
  const t = useTranslations("Header");
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const viPathname = translatePath(pathname, "vi");
  const { cartCount } = useCart();
  const { openPanel, isPanelOpen } = useHeaderUi();

  // Transaction pages reserve this area for their primary action instead of
  // showing a second fixed bar underneath it.
  if (viPathname.startsWith("/gio-hang") || viPathname.startsWith("/dat-hang") || viPathname.startsWith("/don-hang")) return null;

  const badge = cartCount != null && cartCount > 0 ? cartCount : null;
  // Tab Giỏ hàng mở khung xem nhanh (MobileCartSheet) thay vì sang thẳng trang —
  // sáng đèn khi khung đang mở HOẶC khách đã ở thẳng trang Giỏ hàng (vd bấm "Xem
  // giỏ hàng" trong khung, hoặc vào thẳng URL /gio-hang).
  const cartActive = isPanelOpen("cart");
  const cartRouteActive = viPathname.startsWith("/gio-hang");
  const homeActive = isHomePath(pathname);
  // Khi chưa đăng nhập, bấm Tài khoản sẽ bị đẩy sang /dang-nhap (AccountNav). Từ thanh
  // dưới, chỉ nút Tài khoản dẫn tới các trang auth → giữ tab này sáng để không "mất active".
  const accountActive = viPathname.startsWith("/tai-khoan") || isAuthRoute(pathname);

  return (
    <nav
      className={cn(
        "bb-bottom-nav fixed bottom-0 left-0 right-0 z-[var(--bb-z-bottom-nav)] md:hidden",
        "border-t border-[color:var(--bb-mobile-shell-border)] bg-surface-dark text-[color:var(--bb-text-inverse-muted)] backdrop-blur-md",
        "[box-shadow:0_-10px_24px_rgba(0,0,0,0.24)]",
        "[transition:opacity_var(--bb-duration-normal)_var(--bb-ease-standard),transform_var(--bb-duration-normal)_var(--bb-ease-standard),visibility_var(--bb-duration-normal)_var(--bb-ease-standard)]",
      )}
      style={{ paddingBottom: "max(4px, env(safe-area-inset-bottom))" }}
      aria-label={t("primaryNavigation")}
    >
      <div className="flex justify-between gap-0.5 px-2 py-1">
        <Link
          href={toHomePath(locale)}
          className={tabClass(homeActive)}
          aria-current={homeActive ? "page" : undefined}
        >
          {homeActive && <ActiveBar />}
          <Home size={20} aria-hidden />
          <span className={cn(labelCls,homeActive ? "font-semibold" : "font-medium")}>
            {t("fallbackNav.home")}
          </span>
        </Link>

        <button
          type="button"
          onClick={() => openPanel("cart")}
          className={tabClass(cartActive || cartRouteActive)}
          aria-pressed={cartActive}
        >
          {(cartActive || cartRouteActive) && <ActiveBar />}
          <div className="relative">
            <ShoppingCart size={20} aria-hidden />
            {badge != null && (
              <span className="absolute -right-2 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-surface-dark bg-brand px-0.5 font-cta text-b5-label font-bold uppercase leading-none text-white">
                {badge > 99 ? "99+" : badge}
              </span>
            )}
          </div>
          <span className={cn(labelCls, cartActive || cartRouteActive ? "font-semibold" : "font-medium")}>
            {t("mobileCartLink")}
          </span>
        </button>

        <Link
          href={toAccountPath(locale)}
          className={tabClass(accountActive)}
          aria-current={accountActive ? "page" : undefined}
        >
          {accountActive && <ActiveBar />}
          <User size={20} aria-hidden />
          <span className={cn(labelCls,accountActive ? "font-semibold" : "font-medium")}>
            {t("mobileAccountLink")}
          </span>
        </Link>
      </div>
    </nav>
  );
}
