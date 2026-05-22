"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

import type { PublicMenuItem } from "@/lib/contracts/public";
import { normalizeMenuUrl, isActivePath } from "@/lib/utils/nav";

export type HeaderNavNode = PublicMenuItem & { children: HeaderNavNode[] };

type HeaderNavItemProps = {
  node: HeaderNavNode;
};

function isNodeActive(pathname: string | null, node: HeaderNavNode): boolean {
  if (isActivePath(pathname, normalizeMenuUrl(node.url))) return true;
  return node.children.some((child) => isNodeActive(pathname, child));
}

function isMegaNode(node: HeaderNavNode): boolean {
  return node.children.length >= 5 || node.children.some((c) => c.children.length > 0);
}

// ── Mega menu panel ────────────────────────────────────────────────────────
function MegaMenuPanel({
  nodes,
  onItemClick,
  pathname,
}: {
  nodes: HeaderNavNode[];
  onItemClick: () => void;
  pathname: string | null;
}) {
  const t = useTranslations("Header");
  const firstWithChildren = nodes.findIndex((n) => n.children.length > 0);
  const [activeIdx, setActiveIdx] = useState(
    firstWithChildren >= 0 ? firstWithChildren : 0,
  );
  const safeIdx = activeIdx < nodes.length ? activeIdx : 0;
  const activeNode = nodes[safeIdx];

  return (
    <div className="absolute top-full left-0 w-[min(680px,calc(100vw-32px))] bg-card border border-border shadow-lg z-[var(--bb-z-dropdown)]">
      <div className="flex">
        <ul className="list-none m-0 p-0 w-48 shrink-0 border-r border-border py-2">
          {nodes.map((node, index) => (
            <li key={node.id}>
              <Link
                href={normalizeMenuUrl(node.url)}
                className={cn(
                  "flex items-center justify-between px-4 py-2.5 text-sm no-underline transition-colors hover:bg-muted hover:text-brand",
                  index === safeIdx && "bg-muted text-brand font-medium",
                  isNodeActive(pathname, node) && "text-brand",
                )}
                target={node.openInNewTab ? "_blank" : undefined}
                rel={node.openInNewTab ? "noreferrer" : undefined}
                onMouseEnter={() => setActiveIdx(index)}
                onFocus={() => setActiveIdx(index)}
                onClick={onItemClick}
              >
                <span>{node.label}</span>
                {node.children.length > 0 && (
                  <ChevronDown
                    size={14}
                    strokeWidth={2.5}
                    aria-hidden="true"
                    className="-rotate-90 shrink-0 text-muted-foreground"
                  />
                )}
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex-1 p-4 min-h-[180px]">
          {activeNode && activeNode.children.length > 0 ? (
            <ul className="list-none m-0 p-0 columns-2 gap-4">
              {activeNode.children.map((item) => (
                <li key={item.id} className="break-inside-avoid mb-2">
                  <Link
                    href={normalizeMenuUrl(item.url)}
                    className={cn(
                      "block py-1 text-sm font-medium no-underline transition-colors hover:text-brand",
                      isNodeActive(pathname, item) && "text-brand",
                    )}
                    target={item.openInNewTab ? "_blank" : undefined}
                    rel={item.openInNewTab ? "noreferrer" : undefined}
                    onClick={onItemClick}
                  >
                    {item.label}
                  </Link>
                  {item.children.length > 0 && (
                    <ul className="list-none m-0 p-0 pl-3 mt-1 space-y-0.5">
                      {item.children.map((sub) => (
                        <li key={sub.id}>
                          <Link
                            href={normalizeMenuUrl(sub.url)}
                            className={cn(
                              "block text-sm text-muted-foreground no-underline transition-colors hover:text-brand",
                              isNodeActive(pathname, sub) && "text-brand",
                            )}
                            target={sub.openInNewTab ? "_blank" : undefined}
                            rel={sub.openInNewTab ? "noreferrer" : undefined}
                            onClick={onItemClick}
                          >
                            {sub.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="m-0 p-2 text-sm text-muted-foreground italic">{t("megaMenuEmpty")}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Standard sub-menu (dropdown, ≤ 2 levels) ──────────────────────────────
function SubMenu({
  nodes,
  onItemClick,
  pathname,
  nested = false,
}: {
  nodes: HeaderNavNode[];
  onItemClick: () => void;
  pathname: string | null;
  nested?: boolean;
}) {
  return (
    <ul
      className={cn(
        "list-none m-0 p-1 min-w-[200px] bg-card border border-border shadow-dropdown z-[var(--bb-z-dropdown)]",
        nested
          ? "absolute left-full top-0 hidden group-hover:block"
          : "absolute top-full left-0",
      )}
    >
      {nodes.map((child) => {
        const hasChildren = child.children.length > 0;
        const active = isNodeActive(pathname, child);
        return (
          <li key={child.id} className={cn("relative", hasChildren && "group")}>
            <Link
              href={normalizeMenuUrl(child.url)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-sm no-underline transition-colors hover:bg-muted hover:text-brand",
                active && "text-brand font-medium",
              )}
              target={child.openInNewTab ? "_blank" : undefined}
              rel={child.openInNewTab ? "noreferrer" : undefined}
              onClick={onItemClick}
            >
              {child.label}
              {hasChildren && (
                <ChevronDown
                  size={13}
                  strokeWidth={2.5}
                  aria-hidden="true"
                  className="-rotate-90 ml-auto shrink-0 text-muted-foreground"
                />
              )}
            </Link>
            {hasChildren && (
              <SubMenu
                nodes={child.children}
                onItemClick={onItemClick}
                pathname={pathname}
                nested
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

// ── Nav item ───────────────────────────────────────────────────────────────
const menuDelay: [number, number] = [80, 200];

const navLinkBase =
  "bb-header-nav-link flex h-full items-center whitespace-nowrap font-cta text-17 font-semibold uppercase no-underline text-white transition-colors duration-150 hover:text-brand";

export function HeaderNavItem({ node }: HeaderNavItemProps) {
  const pathname = usePathname();
  const href = normalizeMenuUrl(node.url);
  const hasChildren = node.children.length > 0;
  const mega = hasChildren && isMegaNode(node);
  const active = isNodeActive(pathname, node);

  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLAnchorElement>(null);
  const wrapperRef = useRef<HTMLLIElement>(null);
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathnameRef = useRef(pathname);
  const menuId = useId();

  const clearTimers = useCallback(() => {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const openMenu = useCallback(
    (immediate = false) => {
      clearTimers();
      if (immediate) {
        setOpen(true);
        return;
      }
      openTimerRef.current = setTimeout(() => setOpen(true), menuDelay[0]);
    },
    [clearTimers],
  );

  const closeMenu = useCallback(() => {
    clearTimers();
    setOpen(false);
  }, [clearTimers]);

  const scheduleCloseMenu = useCallback(() => {
    clearTimers();
    closeTimerRef.current = setTimeout(() => setOpen(false), menuDelay[1]);
  }, [clearTimers]);

  useEffect(() => {
    if (pathnameRef.current === pathname) return;
    pathnameRef.current = pathname;
    clearTimers();
    setOpen(false);
  }, [pathname, clearTimers]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (wrapperRef.current?.contains(target)) return;
      closeMenu();
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, closeMenu]);

  useEffect(() => {
    if (!open || !mega) return;
    function onScroll() {
      if (window.scrollY > 10) closeMenu();
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [open, mega, closeMenu]);

  if (!hasChildren) {
    return (
      <li
        className={cn(
          "bb-header-nav-item relative flex h-full list-none items-stretch",
          active && "is-active",
        )}
      >
        <Link
          href={href}
          className={cn(navLinkBase, node.cssClass, active && "text-brand")}
          target={node.openInNewTab ? "_blank" : undefined}
          rel={node.openInNewTab ? "noreferrer" : undefined}
          aria-current={active ? "page" : undefined}
        >
          {node.label}
        </Link>
      </li>
    );
  }

  return (
    <li
      ref={wrapperRef}
      className={cn(
        "bb-header-nav-item relative flex h-full list-none items-stretch",
        active && "is-active",
        open && "is-open",
      )}
      onMouseEnter={() => openMenu()}
      onMouseLeave={scheduleCloseMenu}
      onFocusCapture={() => openMenu(true)}
      onBlurCapture={(event) => {
        const nextTarget = event.relatedTarget;
        if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
        scheduleCloseMenu();
      }}
    >
      <Link
        ref={triggerRef}
        href={href}
        className={cn(navLinkBase, node.cssClass, active && "text-brand")}
        target={node.openInNewTab ? "_blank" : undefined}
        rel={node.openInNewTab ? "noreferrer" : undefined}
        aria-current={active ? "page" : undefined}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            closeMenu();
            return;
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            openMenu(true);
            window.setTimeout(() => {
              const firstLink = wrapperRef.current?.querySelector<HTMLAnchorElement>(
                "[data-dropdown] a",
              );
              firstLink?.focus();
            }, 20);
          }
        }}
      >
        {node.label}
      </Link>

      {open && (
        <div id={menuId} data-dropdown>
          {mega ? (
            <MegaMenuPanel nodes={node.children} onItemClick={closeMenu} pathname={pathname} />
          ) : (
            <SubMenu nodes={node.children} onItemClick={closeMenu} pathname={pathname} />
          )}
        </div>
      )}
    </li>
  );
}
