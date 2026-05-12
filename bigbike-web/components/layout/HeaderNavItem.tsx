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
    <ul className={nested ? "wp-sub-menu wp-sub-menu-nested" : "wp-sub-menu"}>
      {nodes.map((child) => {
        const hasChildren = child.children.length > 0;
        const active = isNodeActive(pathname, child);
        return (
          <li
            key={child.id}
            className={
              "wp-sub-menu-item" +
              (hasChildren ? " wp-sub-menu-item-has-children" : "") +
              (active ? " active" : "")
            }
          >
            <Link
              href={normalizeMenuUrl(child.url)}
              target={child.openInNewTab ? "_blank" : undefined}
              rel={child.openInNewTab ? "noreferrer" : undefined}
              onClick={onItemClick}
            >
              {child.label}
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

const menuDelay: [number, number] = [80, 160];

export function HeaderNavItem({ node }: HeaderNavItemProps) {
  const pathname = usePathname();
  const href = normalizeMenuUrl(node.url);
  const hasChildren = node.children.length > 0;
  const active = isNodeActive(pathname, node);
  const linkClass = [node.cssClass, active ? "active" : null]
    .filter(Boolean)
    .join(" ");

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

  if (!hasChildren) {
    return (
      <li className={"wp-navigation-item" + (active ? " active" : "")}>
        <Link
          href={href}
          className={linkClass || undefined}
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
      className={
        "wp-navigation-item wp-navigation-item-has-children" +
        (active ? " active" : "") +
        (open ? " open" : "")
      }
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
        className={linkClass || undefined}
        target={node.openInNewTab ? "_blank" : undefined}
        rel={node.openInNewTab ? "noreferrer" : undefined}
        aria-current={active ? "page" : undefined}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
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
              const firstLink = wrapperRef.current?.querySelector<HTMLAnchorElement>(".wp-sub-menu a");
              firstLink?.focus();
            }, 20);
          }
        }}
      >
        {node.label}
      </Link>
      <div id={menuId} aria-hidden={!open} data-open={open ? "true" : "false"}>
        <SubMenu nodes={node.children} onItemClick={closeMenu} pathname={pathname} />
      </div>
    </li>
  );
}
