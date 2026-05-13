"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { HeaderNavNode } from "@/components/layout/HeaderNavItem";
import { performLogout, useAuth } from "@/lib/auth/auth-store";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  toAccountPath,
  toCartPath,
  toLoginPath,
  toOrderHistoryPath,
  toRegisterPath,
} from "@/lib/utils/routes";
import { normalizeMenuUrl, isActivePath } from "@/lib/utils/nav";
import { cn } from "@/lib/utils";

type MobileHeaderMenuProps = {
  menuTree: HeaderNavNode[];
  menuLabel: string;
  hotline: string;
  zaloUrl: string;
};

function MenuIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{
        transform: open ? "rotate(180deg)" : "rotate(0)",
        transition: "transform 180ms",
      }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

type MobileNavBranchProps = {
  node: HeaderNavNode;
  pathname: string | null;
  onNavigate: () => void;
  depth: number;
};

function MobileNavBranch({ node, pathname, onNavigate, depth }: MobileNavBranchProps) {
  const href = normalizeMenuUrl(node.url);
  const active = isActivePath(pathname, href);
  const hasChildren = node.children.length > 0;
  const [childOpen, setChildOpen] = useState(active && hasChildren);

  if (!hasChildren) {
    return (
      <Link
        href={href}
        className={cn(
          `wp-mobile-nav-link wp-mobile-nav-depth-${depth}`,
          active && "active",
        )}
        onClick={onNavigate}
      >
        {node.label}
      </Link>
    );
  }

  return (
    <div className="wp-mobile-nav-branch">
      <div className={`wp-mobile-nav-row wp-mobile-nav-depth-${depth}`}>
        <Link
          href={href}
          className={cn("wp-mobile-nav-link", active && "active")}
          onClick={onNavigate}
        >
          {node.label}
        </Link>
        <button
          type="button"
          className="wp-mobile-nav-toggle"
          aria-expanded={childOpen}
          aria-label={childOpen ? `Thu gọn ${node.label}` : `Mở rộng ${node.label}`}
          onClick={() => setChildOpen((prev) => !prev)}
        >
          <ChevronIcon open={childOpen} />
        </button>
      </div>
      {childOpen && (
        <div className="wp-mobile-nav-children">
          {node.children.map((child) => (
            <MobileNavBranch
              key={child.id}
              node={child}
              pathname={pathname}
              onNavigate={onNavigate}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function MobileHeaderMenu({
  menuTree,
  menuLabel,
  hotline,
  zaloUrl,
}: MobileHeaderMenuProps) {
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const auth = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const close = () => setOpen(false);

  async function handleLogout() {
    setLoggingOut(true);
    await performLogout();
    setLoggingOut(false);
    close();
    router.push("/");
    router.refresh();
  }

  return (
    <>
      <button
        className="wp-icon-btn wp-menu-toggle"
        aria-label="Mở menu"
        aria-expanded={open}
        type="button"
        onClick={() => setOpen(true)}
      >
        <MenuIcon />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          className="w-[85vw] max-w-xs p-0 flex flex-col bg-[#141414] text-white border-r-0"
        >
          <SheetHeader className="px-4 py-3 border-b border-white/10 shrink-0">
            <SheetTitle className="text-white uppercase font-heading text-sm tracking-wide">
              {menuLabel || "BIGBIKE MENU"}
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            <nav className="wp-mobile-nav" aria-label={menuLabel}>
              {menuTree.map((node) => (
                <MobileNavBranch
                  key={node.id}
                  node={node}
                  pathname={pathname}
                  onNavigate={close}
                  depth={0}
                />
              ))}
            </nav>

            {auth.status === "authenticated" && (
              <div className="wp-mobile-drawer-account">
                <span className="wp-mobile-drawer-account-label">Đang đăng nhập</span>
                <strong title={auth.profile.email}>
                  {auth.profile.displayName?.trim() || auth.profile.email}
                </strong>
              </div>
            )}

            <div className="wp-mobile-drawer-actions">
              <Link href={toCartPath()} onClick={close}>
                Giỏ hàng
              </Link>
              {auth.status === "authenticated" ? (
                <>
                  <Link href={toAccountPath()} onClick={close}>
                    Tài khoản
                  </Link>
                  <Link href={toOrderHistoryPath()} onClick={close}>
                    Đơn hàng
                  </Link>
                  <button
                    type="button"
                    className="wp-mobile-drawer-logout"
                    onClick={handleLogout}
                    disabled={loggingOut}
                  >
                    {loggingOut ? "Đang đăng xuất..." : "Đăng xuất"}
                  </button>
                </>
              ) : (
                <>
                  <Link href={toLoginPath(pathname ?? undefined)} onClick={close}>
                    Đăng nhập
                  </Link>
                  <Link href={toRegisterPath()} onClick={close}>
                    Đăng ký
                  </Link>
                </>
              )}
            </div>

            {(hotline || zaloUrl) && (
              <div className="wp-mobile-drawer-contact">
                {hotline && (
                  <>
                    <span>HOTLINE</span>
                    <b>{hotline}</b>
                  </>
                )}
                {zaloUrl && (
                  <a href={zaloUrl} target="_blank" rel="noreferrer">
                    Zalo hỗ trợ nhanh
                  </a>
                )}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
