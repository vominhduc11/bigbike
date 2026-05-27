"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const DROPDOWN_EXIT_MS = 200;

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

// Reads the CSS custom property --bb-header-height from :root (80px desktop).
function getHeaderHeight(): number {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue("--bb-header-height")
    .trim();
  // Value is e.g. "5rem" or "80px"
  if (raw.endsWith("rem")) {
    return parseFloat(raw) * parseFloat(getComputedStyle(document.documentElement).fontSize);
  }
  return parseFloat(raw) || 80;
}

// Repositions a flyout <ul> to stay within the viewport.
// Call inside requestAnimationFrame AFTER the element is display:block so layout is settled.
function repositionFlyout(el: HTMLUListElement) {
  // Reset inline styles so we measure from the CSS natural position
  el.style.left = "";
  el.style.right = "";
  el.style.top = "";
  el.style.maxHeight = "";
  // Always clip x — never show horizontal scrollbar regardless of content
  el.style.overflowX = "hidden";
  el.style.overflowY = "";

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const headerH = getHeaderHeight();
  // Usable vertical space: from just below header to 8px above viewport bottom
  const topBound = headerH + 4;
  const bottomBound = vh - 8;

  const r = el.getBoundingClientRect();

  // Flip left when overflowing right edge
  if (r.right > vw - 8) {
    el.style.left = "auto";
    el.style.right = "100%";
  }

  // Re-measure after potential flip
  const r2 = el.getBoundingClientRect();

  if (r2.bottom > bottomBound) {
    // How much to shift up, but never above topBound
    const shift = Math.min(r2.bottom - bottomBound, r2.top - topBound);
    if (shift > 0) {
      el.style.top = `-${shift}px`;
    }
    // Re-measure after shift; if still overflowing, constrain height with vertical scroll
    const r3 = el.getBoundingClientRect();
    if (r3.bottom > bottomBound) {
      const available = bottomBound - r3.top;
      if (available > 80) {
        el.style.maxHeight = `${available}px`;
        el.style.overflowY = "auto";
      }
    }
  }
}

function NestedSubMenu({
  nodes,
  onItemClick,
  pathname,
}: {
  nodes: HeaderNavNode[];
  onItemClick: () => void;
  pathname: string | null;
}) {
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const parent = el.closest<HTMLElement>(".bb-nested-group");
    if (!parent) return;

    let rafId = 0;

    function onMouseEnter() {
      if (!el) return;
      // Defer one rAF so the browser has painted the display:block state
      // before we call getBoundingClientRect().
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => repositionFlyout(el));
    }

    function onMouseLeave() {
      cancelAnimationFrame(rafId);
      if (!el) return;
      el.style.left = "";
      el.style.right = "";
      el.style.top = "";
      el.style.maxHeight = "";
      el.style.overflowX = "hidden";
      el.style.overflowY = "";
    }

    parent.addEventListener("mouseenter", onMouseEnter);
    parent.addEventListener("mouseleave", onMouseLeave);
    return () => {
      cancelAnimationFrame(rafId);
      parent.removeEventListener("mouseenter", onMouseEnter);
      parent.removeEventListener("mouseleave", onMouseLeave);
    };
  }, []);

  return (
    <ul
      ref={listRef}
      className="absolute left-full top-0 z-[680] m-0 hidden w-[300px] list-none overflow-x-hidden bg-white p-0 text-left shadow-dropdown group-hover/nested:block"
    >
      {nodes.map((child) => {
        const hasChildren = child.children.length > 0;
        const active = isNodeActive(pathname, child);

        return (
          <li
            key={child.id}
            className={cn(
              "relative border-b border-border last:border-b-0",
              hasChildren && "group/nested bb-nested-group",
            )}
          >
            <Link
              href={normalizeMenuUrl(child.url)}
              className={cn(
                "flex items-center gap-2.5 px-[30px] py-[15px] font-heading text-[14px] font-semibold leading-[1.3] text-muted-foreground no-underline transition-colors duration-300 hover:text-brand",
                active && "text-brand",
              )}
              target={child.openInNewTab ? "_blank" : undefined}
              rel={child.openInNewTab ? "noreferrer" : undefined}
              onClick={onItemClick}
            >
              {child.iconUrl && (
                <span
                  className="bb-submenu-icon"
                  style={{
                    maskImage: `url(${child.iconUrl})`,
                    WebkitMaskImage: `url(${child.iconUrl})`,
                  }}
                  aria-hidden="true"
                />
              )}
              <span className="min-w-0 flex-1">{child.label}</span>
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
              <NestedSubMenu
                nodes={child.children}
                onItemClick={onItemClick}
                pathname={pathname}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

function SubMenu({
  nodes,
  onItemClick,
  pathname,
}: {
  nodes: HeaderNavNode[];
  onItemClick: () => void;
  pathname: string | null;
}) {
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;

    let rafId = 0;

    function clampBottom() {
      if (!el) return;
      el.style.maxHeight = "";
      el.style.overflowY = "";
      // Always hide horizontal overflow — submenu width is fixed at 300px
      el.style.overflowX = "hidden";

      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const bottomBound = vh - 8;

      if (rect.bottom > bottomBound) {
        // Use rect.top (actual position after [data-dropdown] animation settled)
        const available = bottomBound - rect.top;
        if (available > 80) {
          el.style.maxHeight = `${available}px`;
          el.style.overflowY = "auto";
        }
      }
    }

    // Two rAFs: first lets [data-dropdown] opacity/transform transition start,
    // second ensures layout is fully settled before measuring.
    rafId = requestAnimationFrame(() => {
      rafId = requestAnimationFrame(clampBottom);
    });

    window.addEventListener("resize", clampBottom);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", clampBottom);
    };
  }, []);

  return (
    <ul
      ref={listRef}
      className="relative m-0 w-[300px] list-none overflow-x-hidden bg-white p-0 text-left shadow-dropdown"
    >
      {nodes.map((child) => {
        const hasChildren = child.children.length > 0;
        const active = isNodeActive(pathname, child);

        return (
          <li
            key={child.id}
            className={cn(
              "relative border-b border-border last:border-b-0",
              hasChildren && "group/nested bb-nested-group",
            )}
          >
            <Link
              href={normalizeMenuUrl(child.url)}
              className={cn(
                "flex items-center gap-2.5 px-[30px] py-[15px] font-heading text-[14px] font-semibold leading-[1.3] text-muted-foreground no-underline transition-colors duration-300 hover:text-brand",
                active && "text-brand",
              )}
              target={child.openInNewTab ? "_blank" : undefined}
              rel={child.openInNewTab ? "noreferrer" : undefined}
              onClick={onItemClick}
            >
              {child.iconUrl && (
                <span
                  className="bb-submenu-icon"
                  style={{
                    maskImage: `url(${child.iconUrl})`,
                    WebkitMaskImage: `url(${child.iconUrl})`,
                  }}
                  aria-hidden="true"
                />
              )}
              <span className="min-w-0 flex-1">{child.label}</span>
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
              <NestedSubMenu
                nodes={child.children}
                onItemClick={onItemClick}
                pathname={pathname}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

const menuDelay: [number, number] = [0, 120];

const navLinkBase =
  "bb-header-nav-link flex h-full items-center whitespace-nowrap font-cta text-17 font-semibold uppercase no-underline text-white transition-colors duration-150 hover:text-brand-on-dark";

export function HeaderNavItem({ node }: HeaderNavItemProps) {
  const pathname = usePathname();
  const href = normalizeMenuUrl(node.url);
  const hasChildren = node.children.length > 0;
  const active = isNodeActive(pathname, node);

  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const wrapperRef = useRef<HTMLLIElement>(null);
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    if (exitTimerRef.current) {
      clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }
  }, []);

  const openMenu = useCallback(
    (immediate = false) => {
      clearTimers();
      const doOpen = () => {
        setOpen(true);
        setMounted(true);
        requestAnimationFrame(() => setVisible(true));
      };
      if (immediate) {
        doOpen();
        return;
      }
      openTimerRef.current = setTimeout(doOpen, menuDelay[0]);
    },
    [clearTimers],
  );

  const closeMenu = useCallback(() => {
    clearTimers();
    setOpen(false);
    setVisible(false);
    exitTimerRef.current = setTimeout(() => setMounted(false), DROPDOWN_EXIT_MS);
  }, [clearTimers]);

  const scheduleCloseMenu = useCallback(() => {
    clearTimers();
    closeTimerRef.current = setTimeout(() => {
      setOpen(false);
      setVisible(false);
      exitTimerRef.current = setTimeout(() => setMounted(false), DROPDOWN_EXIT_MS);
    }, menuDelay[1]);
  }, [clearTimers]);

  useEffect(() => {
    if (pathnameRef.current === pathname) return;
    pathnameRef.current = pathname;
    clearTimers();
    setOpen(false);
    setVisible(false);
    setMounted(false);
  }, [pathname, clearTimers]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  // Signal html element when nav dropdown is open so floating chat can hide
  useEffect(() => {
    if (open) {
      document.documentElement.setAttribute("data-bb-nav-dropdown-open", "");
    } else {
      // Only remove if no sibling nav dropdown is open
      const anyOpen = document.querySelector(".bb-header-nav-item.is-open");
      if (!anyOpen) {
        document.documentElement.removeAttribute("data-bb-nav-dropdown-open");
      }
    }
  }, [open]);

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
          className={cn(navLinkBase, node.cssClass, active && "text-brand-on-dark")}
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
        href={href}
        className={cn(navLinkBase, node.cssClass, active && "text-brand-on-dark")}
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

      {mounted && (
        <div id={menuId} data-dropdown className={visible ? "is-visible" : ""}>
          <SubMenu nodes={node.children} onItemClick={closeMenu} pathname={pathname} />
        </div>
      )}
    </li>
  );
}
