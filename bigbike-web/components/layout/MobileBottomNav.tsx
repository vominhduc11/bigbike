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

function tabClass(active: boolean) {
  return cn(
    "bb-bottom-nav-item relative flex min-h-14 min-w-14 flex-col items-center justify-center gap-1 px-1",
    active ? "text-brand" : "text-muted-foreground",
  );
}

function ActiveBar() {
  return <span className="absolute left-1/2 top-0 h-0.5 w-6 -translate-x-1/2 bg-brand" />;
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
      className="bb-bottom-nav fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-surface-dark/[0.94] backdrop-blur-md md:hidden"
      style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}
      aria-label="Điều hướng chính"
    >
      <div className="flex justify-around px-1 pb-1 pt-1.5">
        <Link
          href={toHomePath()}
          className={tabClass(homeActive)}
          aria-current={homeActive ? "page" : undefined}
        >
          {homeActive && <ActiveBar />}
          <Home size={22} aria-hidden />
          <span className={cn("text-xs leading-none", homeActive ? "font-semibold" : "font-medium")}>
            Trang chủ
          </span>
        </Link>

        <button
          onClick={() => openPanel("mobile-menu")}
          className={tabClass(menuActive)}
          aria-pressed={menuActive}
          type="button"
        >
          {menuActive && <ActiveBar />}
          <Grid2X2 size={22} aria-hidden />
          <span className={cn("text-xs leading-none", menuActive ? "font-semibold" : "font-medium")}>
            Danh mục
          </span>
        </button>

        <button
          onClick={() => openPanel("search")}
          className={tabClass(searchActive)}
          aria-pressed={searchActive}
          type="button"
        >
          {searchActive && <ActiveBar />}
          <Search size={22} aria-hidden />
          <span className={cn("text-xs leading-none", searchActive ? "font-semibold" : "font-medium")}>
            Tìm kiếm
          </span>
        </button>

        <button
          onClick={() => openPanel("cart")}
          className={tabClass(cartActive || cartRouteActive)}
          aria-pressed={cartActive}
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
          <span className={cn("text-xs leading-none", cartActive || cartRouteActive ? "font-semibold" : "font-medium")}>
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
          <span className={cn("text-xs leading-none", accountActive ? "font-semibold" : "font-medium")}>
            Tài khoản
          </span>
        </Link>
      </div>
    </nav>
  );
}
