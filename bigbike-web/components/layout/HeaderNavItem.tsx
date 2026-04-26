"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import type { PublicMenuItem } from "@/lib/contracts/public";

export type HeaderNavNode = PublicMenuItem & { children: HeaderNavNode[] };

type HeaderNavItemProps = {
  node: HeaderNavNode;
};

function normalizeMenuUrl(url: string): string {
  const trimmed = url.trim();
  return trimmed.length === 0 ? "/" : trimmed;
}

function isActivePath(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/") return pathname === "/";
  const normalizedHref = href.endsWith("/") ? href.slice(0, -1) : href;
  return pathname === normalizedHref || pathname.startsWith(`${normalizedHref}/`);
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

export function HeaderNavItem({ node }: HeaderNavItemProps) {
  const pathname = usePathname();
  const href = normalizeMenuUrl(node.url);
  const hasChildren = node.children.length > 0;
  const active = isActivePath(pathname, href);
  const linkClass = ["wp-nav-link", node.cssClass, active ? "active" : null]
    .filter(Boolean)
    .join(" ");

  const [open, setOpen] = useState(false);
  const [prevPathname, setPrevPathname] = useState(pathname);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelId = useId();

  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    if (open) setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function onClick(event: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  function scheduleClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  }

  function cancelClose() {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
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

  return (
    <div
      ref={wrapperRef}
      className="wp-nav-item-has-children"
      onMouseEnter={() => {
        cancelClose();
        setOpen(true);
      }}
      onMouseLeave={scheduleClose}
      onFocus={() => {
        cancelClose();
        setOpen(true);
      }}
      onBlur={(event) => {
        if (!wrapperRef.current?.contains(event.relatedTarget as Node | null)) {
          scheduleClose();
        }
      }}
    >
      <Link
        href={href}
        className={linkClass}
        aria-current={active ? "page" : undefined}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={panelId}
      >
        <span>{node.label}</span>
        <ChevronIcon />
      </Link>

      <div
        id={panelId}
        className="wp-mega-panel"
        role="menu"
        aria-label={node.label}
        data-open={open ? "true" : "false"}
      >
        <div className="bb-container wp-mega-panel-inner">
          {node.children.map((column) => (
            <div key={column.id} className="wp-mega-column">
              <Link
                href={normalizeMenuUrl(column.url)}
                className="wp-mega-column-title"
                role="menuitem"
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
    </div>
  );
}
