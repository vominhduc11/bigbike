"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { normalizeMenuUrl } from "@/lib/utils/nav";
import { MegaMenu } from "./header-nav/MegaMenu";
import { isNodeActive, type HeaderNavNode } from "./header-nav/shared";

export type { HeaderNavNode };
export { MegaMenu };

const DROPDOWN_EXIT_MS = 200;
const CLOSE_DELAY_MS = 120;

type HeaderNavItemProps = {
  node: HeaderNavNode;
};

// ─── HeaderNavItem ────────────────────────────────────────────────────────────

const menuDelay: [number, number] = [0, CLOSE_DELAY_MS];

const navLinkBase =
  "flex h-full items-center whitespace-nowrap px-[clamp(30px,2.1875vw_-_0.75rem,44px)] pt-[26px] pb-[27px] font-cta text-[length:var(--bb-text-nav)] font-semibold uppercase leading-[1.28] no-underline text-white transition-colors duration-150 hover:text-brand-on-dark focus-visible:text-brand-on-dark focus-visible:outline-none";

// bb-header-nav-item kept as a marker (JS reads `.bb-header-nav-item.is-open`).
// Base layout + the red diamond separator (rendered for every item except the
// last) are inlined; the separator anchors at the item's right edge with zero
// inter-item spacing (margin/padding-right resolved to 0 in the legacy cascade).
const navItemBase =
  "bb-header-nav-item relative flex h-full list-none items-stretch " +
  "[&:not(:last-child)]:after:absolute [&:not(:last-child)]:after:right-0 " +
  "[&:not(:last-child)]:after:top-1/2 [&:not(:last-child)]:after:h-1.5 " +
  "[&:not(:last-child)]:after:w-1.5 [&:not(:last-child)]:after:bg-[var(--bb-action-primary)] " +
  "[&:not(:last-child)]:after:content-[''] " +
  "[&:not(:last-child)]:after:[transform:translate(50%,-50%)_rotate(45deg)]";

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
    if (openTimerRef.current) { clearTimeout(openTimerRef.current); openTimerRef.current = null; }
    if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null; }
    if (exitTimerRef.current) { clearTimeout(exitTimerRef.current); exitTimerRef.current = null; }
  }, []);

  const openMenu = useCallback(
    (immediate = false) => {
      clearTimers();
      const doOpen = () => {
        setOpen(true);
        setMounted(true);
        requestAnimationFrame(() => setVisible(true));
      };
      if (immediate) { doOpen(); return; }
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

  // Signal html so floating chat hides while nav dropdown is open
  useEffect(() => {
    if (open) {
      document.documentElement.setAttribute("data-bb-nav-dropdown-open", "");
    } else {
      const anyOpen = document.querySelector(".bb-header-nav-item.is-open");
      if (!anyOpen) {
        document.documentElement.removeAttribute("data-bb-nav-dropdown-open");
      }
    }
  }, [open]);

  // Close on outside pointer-down
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
      <li className={cn(navItemBase, active && "is-active")}>
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
        navItemBase,
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
        className={cn(navLinkBase, node.cssClass, (active || open) && "text-brand-on-dark")}
        target={node.openInNewTab ? "_blank" : undefined}
        rel={node.openInNewTab ? "noreferrer" : undefined}
        aria-current={active ? "page" : undefined}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onKeyDown={(e) => {
          if (e.key === "Escape") { e.preventDefault(); closeMenu(); return; }
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
        <MegaMenu
          id={menuId}
          node={node}
          visible={visible}
          onItemClick={closeMenu}
          pathname={pathname}
        />
      )}
    </li>
  );
}
