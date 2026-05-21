"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { LOCALES, LOCALE_COOKIE } from "@/i18n/locale";
import type { HeaderNavNode } from "@/components/layout/HeaderNavItem";
import { performLogout, useAuth } from "@/lib/auth/auth-store";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  getSafeLoginHref,
  toAccountPath,
  toCartPath,
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
  t: ReturnType<typeof useTranslations<"Header">>;
};

function MobileNavBranch({ node, pathname, onNavigate, depth, t }: MobileNavBranchProps) {
  const href = normalizeMenuUrl(node.url);
  const active = isActivePath(pathname, href);
  const hasChildren = node.children.length > 0;
  const [childOpen, setChildOpen] = useState(active && hasChildren);

  if (!hasChildren) {
    return (
      <Link
        href={href}
        className={cn(
          `bb-mobile-nav-link bb-mobile-nav-depth-${depth}`,
          active && "active",
        )}
        onClick={onNavigate}
      >
        {node.label}
      </Link>
    );
  }

  return (
    <div className="bb-mobile-nav-branch">
      <div className={`bb-mobile-nav-row bb-mobile-nav-depth-${depth}`}>
        <Link
          href={href}
          className={cn("bb-mobile-nav-link", active && "active")}
          onClick={onNavigate}
        >
          {node.label}
        </Link>
        <button
          type="button"
          className="bb-mobile-nav-toggle"
          aria-expanded={childOpen}
          aria-label={
            childOpen
              ? t("mobileMenuCollapseAriaLabel", { label: node.label })
              : t("mobileMenuExpandAriaLabel", { label: node.label })
          }
          onClick={() => setChildOpen((prev) => !prev)}
        >
          <ChevronIcon open={childOpen} />
        </button>
      </div>
      {childOpen && (
        <div className="bb-mobile-nav-children">
          {node.children.map((child) => (
            <MobileNavBranch
              key={child.id}
              node={child}
              pathname={pathname}
              onNavigate={onNavigate}
              depth={depth + 1}
              t={t}
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
  const t = useTranslations("Header");
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const auth = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();

  const close = () => setOpen(false);

  function switchLocale(next: string) {
    if (next === locale) return;
    // eslint-disable-next-line react-hooks/immutability
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    close();
    startTransition(() => router.refresh());
  }

  const p = pathname?.replace(/\/$/, "") ?? "";
  const isOnLoginPage = p === "/dang-nhap";
  const isOnRegisterPage = p === "/dang-ky";
  const safeLoginHref = getSafeLoginHref(pathname);

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
        className="bb-icon-btn bb-menu-toggle min-[1200px]:!hidden"
        aria-label={t("mobileMenuOpenAriaLabel")}
        aria-expanded={open}
        type="button"
        onClick={() => setOpen(true)}
      >
        <MenuIcon />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          className="w-[85vw] max-w-xs p-0 flex flex-col bg-surface-dark text-white border-r-0"
        >
          <SheetHeader className="px-4 py-3 border-b border-white/10 shrink-0">
            <SheetTitle className="text-white uppercase font-heading text-sm tracking-wide">
              {menuLabel || "BIGBIKE MENU"}
            </SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            <nav className="bb-mobile-nav" aria-label={menuLabel}>
              {menuTree.map((node) => (
                <MobileNavBranch
                  key={node.id}
                  node={node}
                  pathname={pathname}
                  onNavigate={close}
                  depth={0}
                  t={t}
                />
              ))}
            </nav>

            {auth.status === "authenticated" && (
              <div className="bb-mobile-drawer-account">
                <span className="bb-mobile-drawer-account-label">{t("mobileLoggedIn")}</span>
                <strong title={auth.profile.email}>
                  {auth.profile.displayName?.trim() || auth.profile.email}
                </strong>
              </div>
            )}

            <div className="bb-mobile-drawer-actions">
              <Link href={toCartPath()} onClick={close}>
                {t("mobileCartLink")}
              </Link>
              {auth.status === "loading" ? null : auth.status === "authenticated" ? (
                <>
                  <Link href={toAccountPath()} onClick={close}>
                    {t("mobileAccountLink")}
                  </Link>
                  <Link href={toOrderHistoryPath()} onClick={close}>
                    {t("mobileOrdersLink")}
                  </Link>
                  <button
                    type="button"
                    className="bb-mobile-drawer-logout"
                    onClick={handleLogout}
                    disabled={loggingOut}
                  >
                    {loggingOut ? t("mobileLoggingOut") : t("logout")}
                  </button>
                </>
              ) : (
                <>
                  {!isOnLoginPage && (
                    <Link href={safeLoginHref} onClick={close}>
                      {t("login")}
                    </Link>
                  )}
                  {!isOnRegisterPage && (
                    <Link href={toRegisterPath()} onClick={close}>
                      {t("register")}
                    </Link>
                  )}
                </>
              )}
            </div>

            {(hotline || zaloUrl) && (
              <div className="bb-mobile-drawer-contact">
                {hotline && (
                  <>
                    <span>HOTLINE</span>
                    <b>{hotline}</b>
                  </>
                )}
                {zaloUrl && (
                  <a href={zaloUrl} target="_blank" rel="noopener noreferrer">
                    {t("mobileZaloSupport")}
                  </a>
                )}
              </div>
            )}

            <div className="bb-mobile-drawer-language">
              <span>{t("languageLabel")}</span>
              <div className="flex gap-2 mt-2">
                {LOCALES.map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => switchLocale(code)}
                    disabled={isPending || code === locale}
                    className={cn(
                      "px-3 py-1.5 text-xs font-bold uppercase border transition-colors disabled:cursor-wait",
                      code === locale
                        ? "bg-brand text-white border-brand"
                        : "text-white/60 border-white/20 hover:text-white hover:border-white/50",
                    )}
                  >
                    {code}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
