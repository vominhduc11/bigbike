"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";

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

function ChevronIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

const megaMenuDelay: [number, number] = [80, 120];

export function HeaderNavItem({ node }: HeaderNavItemProps) {
  const pathname = usePathname();
  const href = normalizeMenuUrl(node.url);
  const hasChildren = node.children.length > 0;
  const active = isNodeActive(pathname, node);
  const linkClass = ["wp-nav-link", node.cssClass, active ? "active" : null]
    .filter(Boolean)
    .join(" ");

  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLAnchorElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathnameRef = useRef(pathname);
  const panelId = useId();

  const clearMegaTimers = useCallback(() => {
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
      clearMegaTimers();
      if (immediate) {
        setOpen(true);
        return;
      }
      openTimerRef.current = setTimeout(() => setOpen(true), megaMenuDelay[0]);
    },
    [clearMegaTimers],
  );

  const closeMenu = useCallback(() => {
    clearMegaTimers();
    setOpen(false);
  }, [clearMegaTimers]);

  const scheduleCloseMenu = useCallback(() => {
    clearMegaTimers();
    closeTimerRef.current = setTimeout(() => setOpen(false), megaMenuDelay[1]);
  }, [clearMegaTimers]);

  useEffect(() => {
    if (pathnameRef.current === pathname) return;
    pathnameRef.current = pathname;
    clearMegaTimers();
    const closeRouteMenuTimer = window.setTimeout(() => setOpen(false), 0);
    return () => window.clearTimeout(closeRouteMenuTimer);
  }, [pathname, clearMegaTimers]);

  useEffect(() => () => clearMegaTimers(), [clearMegaTimers]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      closeMenu();
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, closeMenu]);

  function closeMenuReturnFocus() {
    closeMenu();
    triggerRef.current?.focus();
  }

  if (!hasChildren) {
    return (
      <Link
        href={href}
        className={linkClass}
        target={node.openInNewTab ? "_blank" : undefined}
        rel={node.openInNewTab ? "noreferrer" : undefined}
        aria-current={active ? "page" : undefined}
      >
        {node.label}
      </Link>
    );
  }

  const megaPanel = (
    <div
      id={panelId}
      ref={panelRef}
      className="wp-mega-panel"
      role="menu"
      aria-label={node.label}
      aria-hidden={!open}
      data-open={open ? "true" : "false"}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          closeMenuReturnFocus();
        }
      }}
    >
      <div className="bb-container wp-mega-panel-inner">
        {node.children.map((column) => (
          <div key={column.id} className="wp-mega-column">
            <Link
              href={normalizeMenuUrl(column.url)}
              className="wp-mega-column-title"
              role="menuitem"
              onClick={closeMenu}
            >
              {column.label}
            </Link>
            {column.children.length > 0 && (
              <ul className="wp-mega-sublist">
                {column.children.map((leaf) => (
                  <li key={leaf.id}>
                    <Link
                      href={normalizeMenuUrl(leaf.url)}
                      className="wp-mega-sublink"
                      role="menuitem"
                      onClick={closeMenu}
                    >
                      {leaf.label}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div
      className="wp-nav-item-has-children"
      onMouseEnter={() => openMenu()}
      onMouseLeave={scheduleCloseMenu}
      onFocusCapture={() => openMenu(true)}
      onBlurCapture={(event) => {
        const nextTarget = event.relatedTarget;
        if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
          return;
        }
        scheduleCloseMenu();
      }}
    >
      <Link
        ref={triggerRef}
        href={href}
        className={linkClass}
        target={node.openInNewTab ? "_blank" : undefined}
        rel={node.openInNewTab ? "noreferrer" : undefined}
        aria-current={active ? "page" : undefined}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={closeMenu}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            closeMenu();
            return;
          }
          if (event.key === "ArrowDown") {
            event.preventDefault();
            openMenu(true);
            window.setTimeout(() => {
              const firstLink = panelRef.current?.querySelector<HTMLAnchorElement>("a");
              firstLink?.focus();
            }, 20);
          }
        }}
      >
        <span>{node.label}</span>
        <ChevronIcon />
      </Link>
      <div
        className="wp-mega-tippy"
        data-bigbike-mega="true"
        data-open={open ? "true" : "false"}
        onMouseEnter={() => openMenu(true)}
        onMouseLeave={scheduleCloseMenu}
      >
        {megaPanel}
      </div>
    </div>
  );
}
