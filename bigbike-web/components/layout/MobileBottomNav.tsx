"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Grid2X2, Home, Search, ShoppingCart, User } from "lucide-react";
import { useHeaderUi } from "@/components/layout/HeaderUiContext";
import { useCart } from "@/lib/cart-context";
import { cn } from "@/lib/utils";
import { toAccountPath, toHomePath } from "@/lib/utils/routes";

function isHomePath(pathname: string) {
  return pathname === "/" || pathname === "";
}

// Mobile-only bottom tab nav (≤767). .bb-bottom-nav is KEPT as a bare marker so the
// two parent-state slide-out rules (html[data-bb-header-panel] / body:has(.bb-pdp-
// sticky-cta.is-visible)) and the transition they animate still apply; everything
// else is inlined. Colors resolve the dark→light reskin to the last-effective layer:
// bg-surface-dark, mobile-shell-border, text-inverse-muted, brand-on-dark (active).
const labelCls =
  "text-xs leading-none max-w-full overflow-hidden text-ellipsis whitespace-nowrap max-[375px]:text-[10px]";

function tabClass(active: boolean) {
  return cn(
    "relative flex flex-col items-center justify-center gap-1 px-1 min-h-[58px] min-w-0 [flex:1_1_0] " +
      "border-none bg-transparent cursor-pointer touch-manipulation font-cta tracking-normal " +
      "text-[color:var(--bb-text-inverse-muted)]",
    active && "text-brand-on-dark",
  );
}

function ActiveBar() {
  return <span className="absolute left-1/2 top-0 h-0.5 w-6 -translate-x-1/2 bg-brand-on-dark" />;
}

export function MobileBottomNav() {
  const pathname = usePathname();
  const { cartCount } = useCart();
  const { openPanel, isPanelOpen } = useHeaderUi();

  const badge = cartCount != null && cartCount > 0 ? cartCount : null;
  const searchActive = isPanelOpen("search");
  const menuActive = isPanelOpen("mobile-menu");
  const cartActive = isPanelOpen("cart");
  const cartRouteActive = pathname.startsWith("/gio-hang");
  const homeActive = isHomePath(pathname);
  const accountActive = pathname.startsWith("/tai-khoan");

  return (
    <nav
      className={cn(
        "bb-bottom-nav fixed bottom-0 left-0 right-0 z-[650] md:hidden",
        "border-t border-[color:var(--bb-mobile-shell-border)] bg-surface-dark text-[color:var(--bb-text-inverse-muted)] backdrop-blur-md",
        "[box-shadow:0_-10px_24px_rgba(0,0,0,0.24)]",
        "[transition:opacity_var(--bb-duration-normal)_var(--bb-ease-standard),transform_var(--bb-duration-normal)_var(--bb-ease-standard),visibility_var(--bb-duration-normal)_var(--bb-ease-standard)]",
      )}
      style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}
      aria-label="Điều hướng chính"
    >
      <div className="flex justify-between gap-0.5 px-1.5 pt-1.5 pb-1">
        <Link
          href={toHomePath()}
          className={tabClass(homeActive)}
          aria-current={homeActive ? "page" : undefined}
        >
          {homeActive && <ActiveBar />}
          <Home size={22} aria-hidden />
          <span className={cn(labelCls,homeActive ? "font-semibold" : "font-medium")}>
            Trang chủ
          </span>
        </Link>

        <button
          onClick={() => openPanel("mobile-menu")}
          className={tabClass(menuActive)}
          aria-pressed={menuActive}
          aria-label="Mở danh mục"
          type="button"
        >
          {menuActive && <ActiveBar />}
          <Grid2X2 size={22} aria-hidden />
          <span className={cn(labelCls,menuActive ? "font-semibold" : "font-medium")}>
            Danh mục
          </span>
        </button>

        <button
          onClick={() => openPanel("search")}
          className={tabClass(searchActive)}
          aria-pressed={searchActive}
          aria-label="Mở tìm kiếm"
          type="button"
        >
          {searchActive && <ActiveBar />}
          <Search size={22} aria-hidden />
          <span className={cn(labelCls,searchActive ? "font-semibold" : "font-medium")}>
            Tìm kiếm
          </span>
        </button>

        <button
          onClick={() => openPanel("cart")}
          className={tabClass(cartActive || cartRouteActive)}
          aria-pressed={cartActive}
          aria-label="Mở giỏ hàng"
          type="button"
        >
          {(cartActive || cartRouteActive) && <ActiveBar />}
          <div className="relative">
            <ShoppingCart size={22} aria-hidden />
            {badge != null && (
              <span className="absolute -right-2 -top-1 h-4 min-w-4 rounded-full border-2 border-surface-dark bg-brand px-1 text-center text-xs font-bold leading-4 text-white">
                {badge > 99 ? "99+" : badge}
              </span>
            )}
          </div>
          <span className={cn(labelCls,cartActive || cartRouteActive ? "font-semibold" : "font-medium")}>
            Giỏ hàng
          </span>
        </button>

        <Link
          href={toAccountPath()}
          className={tabClass(accountActive)}
          aria-current={accountActive ? "page" : undefined}
        >
          {accountActive && <ActiveBar />}
          <User size={22} aria-hidden />
          <span className={cn(labelCls,accountActive ? "font-semibold" : "font-medium")}>
            Tài khoản
          </span>
        </Link>
      </div>
    </nav>
  );
}
