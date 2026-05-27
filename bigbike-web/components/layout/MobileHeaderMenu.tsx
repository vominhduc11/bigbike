"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Clock3, LogOut, MapPin, Phone, UserCircle2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { HeaderNavNode } from "@/components/layout/HeaderNavItem";
import { useHeaderUi } from "@/components/layout/HeaderUiContext";
import { performLogout, useAuth } from "@/lib/auth/auth-store";
import {
  getSafeLoginHref,
  toAccountPath,
  toRegisterPath,
} from "@/lib/utils/routes";
import { isActivePath, normalizeMenuUrl } from "@/lib/utils/nav";
import { cn } from "@/lib/utils";

type MobileHeaderMenuProps = {
  menuTree: HeaderNavNode[];
  menuLabel: string;
  siteName: string;
  hours: string;
  address: string;
  hotline: string;
  hotline2: string;
};

function MenuIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 22 22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="4" y1="6" x2="17.5" y2="6" />
      <line x1="4" y1="11" x2="19" y2="11" />
      <line x1="9" y1="16" x2="19" y2="16" />
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

function MobileNavBranch({
  node,
  pathname,
  onNavigate,
  depth,
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
        className={cn(
          `bb-mobile-nav-link bb-mobile-nav-depth-${depth}`,
          node.iconUrl && "gap-2.5",
          active && "active",
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
    );
  }

  return (
    <div className="bb-mobile-nav-branch">
      <div className={`bb-mobile-nav-row bb-mobile-nav-depth-${depth}`}>
        <Link
          href={href}
          className={cn("bb-mobile-nav-link", node.iconUrl && "gap-2.5", active && "active")}
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
  const hoursLines = (hours.trim() || defaultHours)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const phones = [hotline, hotline2].map((phone) => phone.trim()).filter(Boolean);

  useEffect(() => {
    if (!open) return;

    const timer = window.setTimeout(() => closeButtonRef.current?.focus(), 80);
    return () => window.clearTimeout(timer);
  }, [open]);

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
          "bb-icon-btn bb-menu-toggle hidden md:block min-[1261px]:!hidden",
          open && "is-active",
        )}
        aria-label={t("mobileMenuOpenAriaLabel")}
        aria-expanded={open}
        type="button"
        onClick={() => togglePanel("mobile-menu")}
      >
        <MenuIcon />
      </button>

      <div
        className={cn("bb-mobile-header-panel min-[1261px]:hidden", open && "is-open")}
        aria-hidden={!open}
      >
        <button
          type="button"
          className="bb-mobile-header-overlay"
          aria-label={t("closeDrawer")}
          onClick={close}
        />

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
            <div className="bb-mobile-header-account is-authenticated">
              <div className="bb-mobile-header-account-copy">
                <p>HEY YO!....</p>
                <span title={auth.profile.email}>
                  {auth.profile.displayName?.trim() || auth.profile.email}
                </span>
                <Link href={toAccountPath()} onClick={close}>
                  {t("myAccount")}
                </Link>
              </div>
              <button
                type="button"
                className="bb-mobile-header-logout"
                aria-label={t("logout")}
                onClick={handleLogout}
                disabled={loggingOut}
              >
                <LogOut size={20} aria-hidden />
              </button>
            </div>
          ) : (
            <div className="bb-mobile-header-account">
              <UserCircle2 size={40} aria-hidden className="shrink-0 text-white" />
              <div className="bb-mobile-header-auth-links">
                <Link href={toRegisterPath()} onClick={close}>
                  {t("register")}
                </Link>
                <span>/</span>
                <Link href={safeLoginHref} onClick={close}>
                  {t("login")}
                </Link>
              </div>
            </div>
          )}

          <nav className="bb-mobile-nav" aria-label={menuLabel || "BIGBIKE MENU"}>
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

          <div className="bb-mobile-header-contact">
            <h2>{t("shopInfoContactHeading")}</h2>

            <ul className="bb-mobile-header-contact-list">
              {hoursLines.length > 0 && (
                <li>
                  <span className="bb-mobile-header-contact-icon" aria-hidden="true">
                    <Clock3 size={20} />
                  </span>
                  <div className="bb-mobile-header-contact-copy">
                    {hoursLines.map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </div>
                </li>
              )}

              {address && (
                <li>
                  <span className="bb-mobile-header-contact-icon" aria-hidden="true">
                    <MapPin size={20} />
                  </span>
                  <div className="bb-mobile-header-contact-copy">
                    <p>{t("shopInfoStoreLabel", { siteName })}</p>
                    <p>{address}</p>
                  </div>
                </li>
              )}

              {phones.length > 0 && (
                <li>
                  <span className="bb-mobile-header-contact-icon" aria-hidden="true">
                    <Phone size={20} />
                  </span>
                  <div className="bb-mobile-header-contact-copy">
                    {phones.map((phone) => (
                      <a
                        key={phone}
                        href={`tel:${phone.replace(/[\s.]/g, "")}`}
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
