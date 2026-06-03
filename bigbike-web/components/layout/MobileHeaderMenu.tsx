"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Clock3, LogOut, MapPin, Phone, UserCircle2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { HeaderNavNode } from "@/components/layout/HeaderNavItem";
import { useHeaderUi } from "@/components/layout/HeaderUiContext";
import { MenuIcon } from "@/components/ui/icons";
import { performLogout, useAuth } from "@/lib/auth/auth-store";
import {
  getSafeLoginHref,
  toAccountPath,
  toRegisterPath,
} from "@/lib/utils/routes";
import { isActivePath, normalizeMenuUrl } from "@/lib/utils/nav";
import { cn } from "@/lib/utils";
import { iconBtn } from "@/lib/ui-classes";
import { parsePhones, parseShopHours } from "@/lib/utils/shop";
import { useMediaQueryChange } from "@/lib/hooks/useMediaQueryChange";

type MobileHeaderMenuProps = {
  menuTree: HeaderNavNode[];
  menuLabel: string;
  siteName: string;
  hours: string;
  address: string;
  hotline: string;
  hotline2: string;
};

/* Drawer content uses a dual-theme / dual-structure cascade (kept inline since
   the panel/overlay/drawer transitions stay as CSS shell):
   - base / max-md:  MOBILE ≤767  → dark shell (--bb-mobile-shell-* tokens; only
     defined inside @media ≤767, so always reference them via max-md:)
   - md:             TABLET 768–1260 → white theme (component is hidden ≥1261)
   Borders move between elements per breakpoint: at mobile each nav-link carries
   the divider; at tablet the nav-row carries it. */
const OUTLINE_MOBILE =
  "max-md:focus-visible:[outline:var(--bb-focus-outline)] max-md:focus-visible:[outline-offset:-2px]";

const NAV_LINK_BASE =
  "flex items-center font-cta font-medium uppercase no-underline " +
  "text-white md:text-foreground hover:text-brand-on-dark " +
  "focus-visible:text-brand-on-dark focus-visible:outline-none pointer-coarse:min-h-11 " +
  "max-md:min-h-11 max-md:py-0 max-md:px-[14px] max-md:border-b " +
  "max-md:border-[color:var(--bb-mobile-shell-border)] max-md:text-[14px] max-md:tracking-[0.02em] " +
  "md:px-[25px] md:py-5 md:text-base " +
  OUTLINE_MOBILE;

const NAV_LINK_ACTIVE = "text-brand-on-dark md:text-brand-on-dark";

const NAV_ROW = "relative flex items-stretch md:border-b md:border-[#e8e8e8]";

const NAV_TOGGLE =
  "absolute inline-flex items-center justify-center border-0 bg-transparent cursor-pointer " +
  "text-white md:text-foreground hover:text-brand-on-dark " +
  "focus-visible:text-brand-on-dark focus-visible:outline-none " +
  "max-md:top-2 max-md:right-[10px] max-md:w-11 max-md:h-11 max-md:min-h-11 " +
  "md:top-[18px] md:right-[18px] md:w-9 md:h-9 " +
  OUTLINE_MOBILE;

const ACCOUNT_BASE =
  "flex items-center border-b text-white md:text-foreground " +
  "max-md:gap-3 max-md:px-[14px] max-md:py-4 " +
  "max-md:border-[color:var(--bb-mobile-shell-border)] max-md:bg-[var(--bb-mobile-shell-bg)] " +
  "md:gap-5 md:px-[25px] md:py-[30px] md:border-[#e8e8e8]";

const AUTH_LINK = "text-white md:text-foreground no-underline";

const CONTACT_COPY =
  "m-0 font-body text-[length:var(--fs-caption)] font-normal leading-[1.7] text-[#cecece] md:text-black";

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
  t: ReturnType<typeof useTranslations<"Header">>;
};

function MobileNavBranch({
  node,
  pathname,
  onNavigate,
  t,
}: MobileNavBranchProps) {
  const href = normalizeMenuUrl(node.url);
  const active = isActivePath(pathname, href);
  const hasChildren = node.children.length > 0;
  const [childOpen, setChildOpen] = useState(active && hasChildren);

  if (!hasChildren) {
    return (
      <Link
        href={href}
        className={cn(NAV_LINK_BASE, node.iconUrl && "gap-2.5", active && NAV_LINK_ACTIVE)}
        onClick={onNavigate}
      >
        {node.iconUrl && (
          <span
            className="bb-submenu-icon"
            style={{
              maskImage: `url(${node.iconUrl})`,
              WebkitMaskImage: `url(${node.iconUrl})`,
            }}
            aria-hidden="true"
          />
        )}
        {node.label}
      </Link>
    );
  }

  return (
    <div>
      <div className={NAV_ROW}>
        <Link
          href={href}
          className={cn(
            NAV_LINK_BASE,
            "flex-1 max-md:pr-[62px] md:pr-[72px]",
            node.iconUrl && "gap-2.5",
            active && NAV_LINK_ACTIVE,
          )}
          onClick={onNavigate}
        >
          {node.iconUrl && (
            <span
              className="bb-submenu-icon"
              style={{
                maskImage: `url(${node.iconUrl})`,
                WebkitMaskImage: `url(${node.iconUrl})`,
              }}
              aria-hidden="true"
            />
          )}
          {node.label}
        </Link>
        <button
          type="button"
          className={NAV_TOGGLE}
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

      <div className={cn("bb-mobile-nav-children", childOpen && "is-open")}>
        <div>
          {node.children.map((child) => (
            <MobileNavBranch
              key={child.id}
              node={child}
              pathname={pathname}
              onNavigate={onNavigate}
              t={t}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function MobileHeaderMenu({
  menuTree,
  menuLabel,
  siteName,
  hours,
  address,
  hotline,
  hotline2,
}: MobileHeaderMenuProps) {
  const t = useTranslations("Header");
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const auth = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const { isPanelOpen, togglePanel, closePanel } = useHeaderUi();
  const open = isPanelOpen("mobile-menu");
  const safeLoginHref = getSafeLoginHref(pathname);
  const defaultHours = [
    t("shopInfoDefaultHoursLine1"),
    t("shopInfoDefaultHoursLine2"),
    t("shopInfoDefaultHoursLine3"),
  ].join("\n");
  const hoursLines = parseShopHours(hours, defaultHours);
  const phones = parsePhones(hotline, hotline2);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => closeButtonRef.current?.focus(), 80);
    return () => window.clearTimeout(timer);
  }, [open]);

  useMediaQueryChange("(min-width: 1261px)", closePanel);

  function close() {
    closePanel();
  }

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
        className={cn(
          iconBtn,
          "bb-menu-toggle hidden md:inline-flex min-[1261px]:!hidden",
          open && "is-active",
        )}
        aria-label={t("mobileMenuOpenAriaLabel")}
        aria-expanded={open}
        type="button"
        onClick={() => togglePanel("mobile-menu")}
      >
        <MenuIcon />
      </button>

      <button
        type="button"
        className={cn("bb-mobile-header-overlay min-[1261px]:hidden", open && "is-open")}
        aria-label={t("closeDrawer")}
        onClick={close}
      />

      <div
        className={cn("bb-mobile-header-panel min-[1261px]:hidden", open && "is-open")}
        aria-hidden={!open}
      >

        <div className="bb-mobile-header-drawer" role="dialog" aria-modal="true" aria-label={menuLabel || "BIGBIKE MENU"}>
          <div className="bb-mobile-drawer-head">
            <Link href="/" aria-label={siteName} onClick={close}>
              <Image src="/wp/logo-1.png" alt={siteName} width={150} height={55} priority />
            </Link>
            <button ref={closeButtonRef} type="button" aria-label={t("closeDrawer")} onClick={close}>
              <X size={22} aria-hidden />
            </button>
          </div>

          {auth.status === "authenticated" ? (
            <div className={cn(ACCOUNT_BASE, "relative items-start")}>
              <div>
                <p className="m-0 text-base font-semibold uppercase">{t("loggedInGreeting")}</p>
                <span
                  title={auth.profile.email}
                  className="block text-base font-semibold normal-case"
                >
                  {auth.profile.displayName?.trim() || auth.profile.email}
                </span>
                <Link
                  href={toAccountPath()}
                  onClick={close}
                  className="mt-3 inline-block text-[length:var(--fs-caption)] font-normal capitalize no-underline text-[#4b4b4b] md:text-brand-on-dark"
                >
                  {t("myAccount")}
                </Link>
              </div>
              <button
                type="button"
                className={cn(
                  "absolute right-[25px] top-1/2 -translate-y-1/2 cursor-pointer border-0 bg-transparent text-white md:text-foreground",
                  OUTLINE_MOBILE,
                )}
                aria-label={t("logout")}
                onClick={handleLogout}
                disabled={loggingOut}
              >
                <LogOut size={20} aria-hidden />
              </button>
            </div>
          ) : (
            <div className={ACCOUNT_BASE}>
              <UserCircle2 size={40} aria-hidden className="shrink-0" />
              <div className="text-base text-white md:text-foreground">
                <Link href={toRegisterPath()} onClick={close} className={AUTH_LINK}>
                  {t("register")}
                </Link>
                <span className="mx-2">/</span>
                <Link href={safeLoginHref} onClick={close} className={AUTH_LINK}>
                  {t("login")}
                </Link>
              </div>
            </div>
          )}

          <nav className="grid" aria-label={menuLabel || "BIGBIKE MENU"}>
            {menuTree.map((node) => (
              <MobileNavBranch
                key={node.id}
                node={node}
                pathname={pathname}
                onNavigate={close}
                t={t}
              />
            ))}
          </nav>

          <div className="border-t text-left text-[#cecece] md:text-[#6f6f6f] max-md:mt-auto max-md:px-[14px] max-md:pt-[18px] max-md:pb-[calc(16px_+_env(safe-area-inset-bottom))] max-md:border-[color:var(--bb-mobile-shell-border)] max-md:bg-[var(--bb-mobile-shell-surface-2)] md:px-[25px] md:py-[30px] md:border-[#e8e8e8]">
            <h2 className="m-0 font-display text-base font-semibold uppercase text-white md:text-foreground">
              {t("shopInfoContactHeading")}
            </h2>

            <ul className="grid list-none p-0 gap-[14px] mt-4 md:gap-[30px] md:mt-[30px]">
              {hoursLines.length > 0 && (
                <li className="grid grid-cols-[40px_minmax(0,1fr)] gap-4">
                  <span className="text-brand-on-dark" aria-hidden="true">
                    <Clock3 size={20} />
                  </span>
                  <div>
                    {hoursLines.map((line) => (
                      <p key={line} className={CONTACT_COPY}>{line}</p>
                    ))}
                  </div>
                </li>
              )}

              {address && (
                <li className="grid grid-cols-[40px_minmax(0,1fr)] gap-4">
                  <span className="text-brand-on-dark" aria-hidden="true">
                    <MapPin size={20} />
                  </span>
                  <div>
                    <p className={CONTACT_COPY}>{t("shopInfoStoreLabel", { siteName })}</p>
                    <p className={CONTACT_COPY}>{address}</p>
                  </div>
                </li>
              )}

              {phones.length > 0 && (
                <li className="grid grid-cols-[40px_minmax(0,1fr)] gap-4">
                  <span className="text-brand-on-dark" aria-hidden="true">
                    <Phone size={20} />
                  </span>
                  <div>
                    {phones.map((phone) => (
                      <a
                        key={phone}
                        href={`tel:${phone.replace(/[\s.]/g, "")}`}
                        className={cn(CONTACT_COPY, "block no-underline hover:text-brand-on-dark")}
                      >
                        {phone}
                      </a>
                    ))}
                  </div>
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
