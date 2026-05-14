"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

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
  const quickLinks = nodes.filter((n) => n.children.length === 0);
  const columns = nodes.filter((n) => n.children.length > 0);

  return (
    <div className="mega-panel">
      <div className="mega-panel-inner">
        {quickLinks.length > 0 && (
          <div className="mega-quicklinks">
            {quickLinks.map((node) => (
              <Link
                key={node.id}
                href={normalizeMenuUrl(node.url)}
                className={isNodeActive(pathname, node) ? "active" : undefined}
                target={node.openInNewTab ? "_blank" : undefined}
                rel={node.openInNewTab ? "noreferrer" : undefined}
                onClick={onItemClick}
              >
                {node.label}
              </Link>
            ))}
          </div>
        )}

        <div className="mega-columns">
          {columns.map((col) => (
            <div key={col.id} className="mega-col">
              <Link
                href={normalizeMenuUrl(col.url)}
                className={"mega-col-title" + (isNodeActive(pathname, col) ? " active" : "")}
                target={col.openInNewTab ? "_blank" : undefined}
                rel={col.openInNewTab ? "noreferrer" : undefined}
                onClick={onItemClick}
              >
                {col.label}
              </Link>
              <ul className="mega-col-list">
                {col.children.map((item) => (
                  <li key={item.id} className="mega-col-item">
                    <Link
                      href={normalizeMenuUrl(item.url)}
                      className={isNodeActive(pathname, item) ? "active" : undefined}
                      target={item.openInNewTab ? "_blank" : undefined}
                      rel={item.openInNewTab ? "noreferrer" : undefined}
                      onClick={onItemClick}
                    >
                      {item.label}
                    </Link>
                    {item.children.length > 0 && (
                      <ul className="mega-col-sublist">
                        {item.children.map((sub) => (
                          <li key={sub.id}>
                            <Link
                              href={normalizeMenuUrl(sub.url)}
                              className={isNodeActive(pathname, sub) ? "active" : undefined}
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
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Standard sub-menu (dropdown thường, ≤ 2 cấp) ──────────────────────────
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
    <ul className={nested ? "bb-sub-menu bb-sub-menu-nested" : "bb-sub-menu"}>
      {nodes.map((child) => {
        const hasChildren = child.children.length > 0;
        const active = isNodeActive(pathname, child);
        return (
          <li
            key={child.id}
            className={
              "bb-sub-menu-item" +
              (hasChildren ? " bb-sub-menu-item-has-children" : "") +
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
              {hasChildren && (
                <ChevronDown
                  className="sub-chevron"
                  size={13}
                  strokeWidth={2.5}
                  aria-hidden="true"
                  style={{ transform: "rotate(-90deg)", marginLeft: "auto", flexShrink: 0 }}
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

export function HeaderNavItem({ node }: HeaderNavItemProps) {
  const pathname = usePathname();
  const href = normalizeMenuUrl(node.url);
  const hasChildren = node.children.length > 0;
  const mega = hasChildren && isMegaNode(node);
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
      <li className={"bb-navigation-item" + (active ? " active" : "")}>
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
        "bb-navigation-item bb-navigation-item-has-children" +
        (mega ? " mega-item" : "") +
        (active ? " active" : "") +
        (open ? " open" : "")
      }
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
        className={linkClass || undefined}
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
                ".mega-col-title, .bb-sub-menu a",
              );
              firstLink?.focus();
            }, 20);
          }
        }}
      >
        {node.label}
        <ChevronDown className="nav-chevron" size={14} strokeWidth={2.5} aria-hidden="true" />
      </Link>

      <div id={menuId} aria-hidden={!open} data-open={open ? "true" : "false"}>
        {mega ? (
          <MegaMenuPanel nodes={node.children} onItemClick={closeMenu} pathname={pathname} />
        ) : (
          <SubMenu nodes={node.children} onItemClick={closeMenu} pathname={pathname} />
        )}
      </div>
    </li>
  );
}
