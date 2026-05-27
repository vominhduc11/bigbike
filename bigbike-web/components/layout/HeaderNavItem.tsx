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
        "m-0 w-[300px] list-none bg-white p-0 text-left shadow-dropdown z-[var(--bb-z-dropdown)]",
        nested ? "absolute left-full top-0 hidden group-hover:block" : "absolute top-full left-0",
      )}
    >
      {nodes.map((child) => {
        const hasChildren = child.children.length > 0;
        const active = isNodeActive(pathname, child);

        return (
          <li
            key={child.id}
            className={cn(
              "relative border-b border-border last:border-b-0",
              hasChildren && "group",
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

const menuDelay: [number, number] = [0, 0];

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
