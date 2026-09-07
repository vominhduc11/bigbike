"use client";

import { useLayoutEffect, useRef } from "react";
import Link from "@/i18n/StorefrontLink";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Home, Search, ShoppingCart, User } from "lucide-react";
import { useHeaderUi } from "@/components/layout/HeaderUiContext";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart-context";
import { cn } from "@/lib/utils";
import { isAuthRoute, toAccountPath, toHomePath, translatePath } from "@/lib/utils/routes";
import type { Locale } from "@/i18n/locale";

// Mobile-only bottom tab nav (≤767). .bb-bottom-nav is KEPT as a bare marker so the
// two parent-state slide-out rules (html[data-bb-header-panel] / body:has(.bb-pdp-
// sticky-cta.is-visible)) and the transition they animate still apply; everything
// else is inlined. Colors resolve the dark→light reskin to the last-effective layer:
// bg-surface-dark, mobile-shell-border, text-inverse-muted, brand-on-dark (active).
const labelCls =
  "w-full min-w-0 whitespace-normal text-center font-cta text-b5-label uppercase leading-tight";

function tabClass(active: boolean) {
  return cn(
    "relative flex h-auto min-h-12 min-w-0 w-full flex-col items-center justify-start gap-1 rounded-none px-0.5 py-1 " +
      "border-none bg-transparent cursor-pointer touch-manipulation font-cta tracking-normal hover:bg-black hover:not-disabled:scale-100 " +
      // `!` defeats the legacy unlayered theme that otherwise paints every tab
      // with its own link color and erases the active/inactive distinction.
      "text-white/50! transition-colors duration-150",
    active && "text-[color:var(--bb-brand-primary-on-dark)]!",
  );
}

function ActiveBar() {
  return (
    <span className="absolute left-1/2 top-0 h-0.5 w-6 -translate-x-1/2 bg-[color:var(--bb-brand-primary-on-dark)]" />
  );
}

export function MobileBottomNav() {
  const t = useTranslations("Header");
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const viPathname = translatePath(pathname, "vi");
  const { cartCount } = useCart();
  const { openPanel, isPanelOpen } = useHeaderUi();
  const navRef = useRef<HTMLElement>(null);

  // Transaction pages reserve this area for their primary action instead of
  // showing a second fixed bar underneath it.
  const hiddenOnRoute =
    viPathname.startsWith("/gio-hang") ||
    viPathname.startsWith("/dat-hang") ||
    viPathname.startsWith("/don-hang");

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const root = document.documentElement;
    const heightProperty = "--bb-mobile-nav-height";
    const previousHeight = root.style.getPropertyValue(heightProperty);
    const restoreHeight = () => {
      if (previousHeight) root.style.setProperty(heightProperty, previousHeight);
      else root.style.removeProperty(heightProperty);
    };
    const syncHeight = () => {
      const height = nav.getBoundingClientRect().height;
      if (!height) {
        restoreHeight();
        return;
      }
      // Các phần chừa chỗ đã cộng safe area riêng; chỉ đồng bộ chiều cao thanh.
      const safeArea =
        Number.parseFloat(getComputedStyle(nav).getPropertyValue("--bb-mobile-nav-safe-area")) || 0;
      const value = `${Math.ceil(height - safeArea)}px`;
      if (root.style.getPropertyValue(heightProperty) !== value) {
        root.style.setProperty(heightProperty, value);
      }
    };

    syncHeight();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(syncHeight);
    observer?.observe(nav, { box: "border-box" });
    window.addEventListener("resize", syncHeight);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", syncHeight);
      restoreHeight();
    };
  }, [hiddenOnRoute]);

  if (hiddenOnRoute) return null;

  const badge = cartCount != null && cartCount > 0 ? cartCount : null;
  // Tab Giỏ hàng mở khung xem nhanh (MobileCartSheet) thay vì sang thẳng trang —
  // sáng đèn khi khung đang mở HOẶC khách đã ở thẳng trang Giỏ hàng (vd bấm "Xem
  // giỏ hàng" trong khung, hoặc vào thẳng URL /gio-hang).
  const cartActive = isPanelOpen("cart");
  const searchOpen = isPanelOpen("search");
  const searchRouteActive = viPathname.replace(/\/+$/, "") === "/tim-kiem";
  const searchActive = searchOpen || searchRouteActive;
  const cartRouteActive = viPathname.startsWith("/gio-hang");
  // Server có thể thấy rewrite nội bộ; dấu chọn phải khớp URL công khai khi hydrate.
  const homeActive = viPathname === "/" || viPathname === "/internal/home/";
  // Khi chưa đăng nhập, bấm Tài khoản sẽ bị đẩy sang /dang-nhap (AccountNav). Từ thanh
  // dưới, chỉ nút Tài khoản dẫn tới các trang auth → giữ tab này sáng để không "mất active".
  const accountActive = viPathname.startsWith("/tai-khoan") || isAuthRoute(pathname);

  return (
    <nav
      ref={navRef}
      className={cn(
        "bb-bottom-nav @container/bottom-nav fixed bottom-0 left-0 right-0 z-[var(--bb-z-bottom-nav)] text-b5-label! md:hidden",
        "border-t border-[color:var(--bb-mobile-shell-border)] bg-surface-dark text-[color:var(--bb-text-inverse-muted)] backdrop-blur-md",
        "[--bb-mobile-nav-safe-area:env(safe-area-inset-bottom,0px)] pb-[calc(var(--spacing)+var(--bb-mobile-nav-safe-area))]",
        "[box-shadow:0_-10px_24px_rgba(0,0,0,0.24)]",
        "[transition:opacity_var(--bb-duration-normal)_var(--bb-ease-standard),transform_var(--bb-duration-normal)_var(--bb-ease-standard),visibility_var(--bb-duration-normal)_var(--bb-ease-standard)]",
      )}
      aria-label={t("primaryNavigation")}
    >
      <div className="grid auto-rows-fr grid-cols-2 pt-1 @min-[24em]/bottom-nav:grid-cols-4">
        <Button asChild variant="ghost" className={tabClass(homeActive)}>
          <Link href={toHomePath(locale)} aria-current={homeActive ? "page" : undefined}>
            {homeActive && <ActiveBar />}
            <Home className="size-6 shrink-0" aria-hidden />
            <span
              data-bottom-nav-label
              className={cn(labelCls, homeActive ? "font-semibold" : "font-medium")}
            >
              {t("fallbackNav.home")}
            </span>
          </Link>
        </Button>

        <Button
          type="button"
          variant="ghost"
          onClick={(event) => openPanel("search", event.currentTarget)}
          className={tabClass(searchActive)}
          aria-current={searchRouteActive ? "page" : undefined}
          aria-pressed={searchOpen}
        >
          {searchActive && <ActiveBar />}
          <Search className="size-6 shrink-0" aria-hidden />
          <span
            data-bottom-nav-label
            className={cn(labelCls, searchActive ? "font-semibold" : "font-medium")}
          >
            {t("mobileSearchLink")}
          </span>
        </Button>

        <Button
          type="button"
          variant="ghost"
          onClick={(event) => openPanel("cart", event.currentTarget)}
          className={tabClass(cartActive || cartRouteActive)}
          aria-pressed={cartActive}
        >
          {(cartActive || cartRouteActive) && <ActiveBar />}
          <div className="relative">
            <ShoppingCart className="size-6 shrink-0" aria-hidden />
            {badge != null && (
              <span className="absolute -right-2 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-surface-dark bg-brand px-0.5 font-cta text-b5-label font-bold uppercase leading-none text-white">
                {badge > 99 ? "99+" : badge}
              </span>
            )}
          </div>
          <span
            data-bottom-nav-label
            className={cn(
              labelCls,
              cartActive || cartRouteActive ? "font-semibold" : "font-medium",
            )}
          >
            {t("mobileCartLink")}
          </span>
        </Button>

        <Button asChild variant="ghost" className={tabClass(accountActive)}>
          <Link
            href={toAccountPath(locale)}
            prefetch={false}
            aria-current={accountActive ? "page" : undefined}
          >
            {accountActive && <ActiveBar />}
            <User className="size-6 shrink-0" aria-hidden />
            <span
              data-bottom-nav-label
              className={cn(labelCls, accountActive ? "font-semibold" : "font-medium")}
            >
              {t("mobileAccountLink")}
            </span>
          </Link>
        </Button>
      </div>
    </nav>
  );
}
