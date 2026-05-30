"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const DROPDOWN_EXIT_MS = 200;
const CLOSE_DELAY_MS = 120;

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

// ─── MegaPanel ───────────────────────────────────────────────────────────────
// Right side: L3 grid for one L2 group. L4 renders as indented sub-list.

function MegaPanel({
  group,
  onItemClick,
  pathname,
  active,
}: {
  group: HeaderNavNode;
  onItemClick: () => void;
  pathname: string | null;
  active: boolean;
}) {
  return (
    <div className={cn("flex-1 p-6", active ? "block" : "hidden")}>
      {group.children.length === 0 ? (
        <p className="font-nav text-[13px] text-muted-foreground">{group.label}</p>
      ) : (
        <ul className="m-0 list-none columns-2 gap-x-8 p-0 xl:columns-3">
          {group.children.map((cat) => {
            const catActive = isNodeActive(pathname, cat);
            const hasL4 = cat.children.length > 0;
            return (
              <li key={cat.id} className="mb-5 break-inside-avoid">
                <Link
                  href={normalizeMenuUrl(cat.url)}
                  className={cn(
                    "mb-1.5 flex items-center gap-2 font-nav text-[13px] font-bold uppercase tracking-wide text-foreground no-underline transition-colors duration-150 hover:text-brand",
                    catActive && "text-brand",
                  )}
                  target={cat.openInNewTab ? "_blank" : undefined}
                  rel={cat.openInNewTab ? "noreferrer" : undefined}
                  onClick={onItemClick}
                >
                  {cat.iconUrl && (
                    <span
                      className="bb-submenu-icon shrink-0"
                      style={{
                        maskImage: `url(${cat.iconUrl})`,
                        WebkitMaskImage: `url(${cat.iconUrl})`,
                      }}
                      aria-hidden="true"
                    />
                  )}
                  {cat.label}
                </Link>
                {hasL4 && (
                  <ul className="m-0 list-none p-0">
                    {cat.children.map((item) => {
                      const itemActive = isActivePath(pathname, normalizeMenuUrl(item.url));
                      return (
                        <li key={item.id}>
                          <Link
                            href={normalizeMenuUrl(item.url)}
                            className={cn(
                              "block py-0.5 font-nav text-xs text-muted-foreground no-underline transition-colors duration-150 hover:text-brand",
                              itemActive && "text-brand",
                            )}
                            target={item.openInNewTab ? "_blank" : undefined}
                            rel={item.openInNewTab ? "noreferrer" : undefined}
                            onClick={onItemClick}
                          >
                            {item.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ─── MegaSidebar ─────────────────────────────────────────────────────────────
// Left column: L2 groups. Hover/focus activates right panel.
// Leaf groups (no children) are plain navigation links.

function MegaSidebar({
  groups,
  activeId,
  onActivate,
  onItemClick,
  pathname,
}: {
  groups: HeaderNavNode[];
  activeId: string;
  onActivate: (id: string) => void;
  onItemClick: () => void;
  pathname: string | null;
}) {
  return (
    <nav
      aria-label="Danh mục sản phẩm"
      className="w-52 shrink-0 border-r border-border bg-[#f9f9f9] py-3 xl:w-60"
    >
      <ul className="m-0 list-none p-0">
        {groups.map((group) => {
          const hasChildren = group.children.length > 0;
          const isActive = group.id === activeId;
          const groupPathActive = isNodeActive(pathname, group);

          if (!hasChildren) {
            return (
              <li key={group.id}>
                <Link
                  href={normalizeMenuUrl(group.url)}
                  className={cn(
                    "flex w-full items-center gap-2.5 px-5 py-3 font-nav text-[13px] font-semibold text-foreground no-underline transition-colors duration-150 hover:bg-white hover:text-brand",
                    groupPathActive && "text-brand",
                  )}
                  target={group.openInNewTab ? "_blank" : undefined}
                  rel={group.openInNewTab ? "noreferrer" : undefined}
                  onClick={onItemClick}
                >
                  {group.iconUrl && (
                    <span
                      className="bb-submenu-icon shrink-0"
                      style={{
                        maskImage: `url(${group.iconUrl})`,
                        WebkitMaskImage: `url(${group.iconUrl})`,
                      }}
                      aria-hidden="true"
                    />
                  )}
                  <span className="min-w-0 flex-1">{group.label}</span>
                </Link>
              </li>
            );
          }

          return (
            <li key={group.id}>
              <button
                type="button"
                className={cn(
                  "flex w-full items-center gap-2.5 px-5 py-3 font-nav text-[13px] font-semibold text-foreground transition-colors duration-150 hover:bg-white hover:text-brand",
                  isActive && "bg-white text-brand",
                  groupPathActive && "text-brand",
                )}
                onMouseEnter={() => onActivate(group.id)}
                onFocus={() => onActivate(group.id)}
                aria-expanded={isActive}
              >
                {group.iconUrl && (
                  <span
                    className="bb-submenu-icon shrink-0"
                    style={{
                      maskImage: `url(${group.iconUrl})`,
                      WebkitMaskImage: `url(${group.iconUrl})`,
                    }}
                    aria-hidden="true"
                  />
                )}
                <span className="min-w-0 flex-1 text-left">{group.label}</span>
                <ChevronRight
                  size={13}
                  strokeWidth={2.5}
                  aria-hidden="true"
                  className={cn(
                    "ml-auto shrink-0 transition-colors duration-150",
                    isActive ? "text-brand" : "text-muted-foreground",
                  )}
                />
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// ─── MegaMenu ────────────────────────────────────────────────────────────────
// Container: owns activeGroupId, renders sidebar + all panels side-by-side.
// Wrapped by the existing [data-dropdown] / is-visible animation mechanism.

function MegaMenu({
  id,
  node,
  visible,
  onItemClick,
  pathname,
}: {
  id: string;
  node: HeaderNavNode;
  visible: boolean;
  onItemClick: () => void;
  pathname: string | null;
}) {
  const defaultActiveId =
    node.children.find((c) => c.children.length > 0)?.id ?? node.children[0]?.id ?? "";
  const [activeId, setActiveId] = useState(defaultActiveId);

  return (
    <div
      id={id}
      data-dropdown
      className={cn(
        "fixed left-1/2 -translate-x-1/2",
        "top-[var(--bb-header-height)]",
        "z-[var(--bb-z-dropdown)]",
        "w-[min(75rem,calc(100vw-2rem))]",
        "max-h-[calc(100vh-var(--bb-header-height)-0.5rem)] overflow-y-auto overflow-x-hidden",
        "bg-white shadow-dropdown",
        visible && "is-visible",
      )}
      role="menu"
      aria-label={node.label}
    >
      <div className="flex min-h-[320px]">
        <MegaSidebar
          groups={node.children}
          activeId={activeId}
          onActivate={setActiveId}
          onItemClick={onItemClick}
          pathname={pathname}
        />
        <div className="min-w-0 flex-1">
          {node.children.map((group) => (
            <MegaPanel
              key={group.id}
              group={group}
              onItemClick={onItemClick}
              pathname={pathname}
              active={group.id === activeId}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── HeaderNavItem ────────────────────────────────────────────────────────────

const menuDelay: [number, number] = [0, CLOSE_DELAY_MS];

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
      <li className={cn("bb-header-nav-item relative flex h-full list-none items-stretch", active && "is-active")}>
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
