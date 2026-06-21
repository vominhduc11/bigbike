"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { submenuIcon } from "@/lib/ui-classes";
import { normalizeMenuUrl, isActivePath } from "@/lib/utils/nav";
import { isNodeActive, type HeaderNavNode } from "./shared";

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
  // Column count follows item count (≈2 per column, capped at 3) so the panel —
  // and thus the content-hugging dropdown width — never reserves empty columns
  // for sparse categories.
  const columnCount = Math.min(3, Math.max(1, Math.ceil(group.children.length / 2)));
  return (
    <div
      className={cn(
        // All panels share one grid cell ([grid-area:1/1]) so the wrapper width is
        // always the widest panel → the dropdown size stays fixed when switching
        // groups. Inactive panels stay laid out (invisible, not display:none) so
        // they keep contributing to that max width. Content is left-aligned
        // (items-start) so categories read top-left, matching the original layout.
        "[grid-area:1/1] flex flex-col items-start justify-start p-6 transition-opacity duration-150",
        active ? "opacity-100" : "invisible pointer-events-none opacity-0",
      )}
    >
      {group.children.length === 0 ? (
        <p className="font-body text-13 text-muted-foreground">{group.label}</p>
      ) : (
        // max-width lets the fixed column-count shrink (and labels wrap) instead
        // of pushing the panel past the viewport — where the wrapper's
        // overflow-x-hidden would clip long-label categories on narrow desktops.
        // 15rem = widest sidebar (xl:w-60), 3rem = panel p-6 both sides.
        <ul
          className="m-0 list-none gap-x-8 p-0 [max-width:clamp(480px,43vw,760px)]"
          style={{ columnCount }}
        >
          {group.children.map((cat) => {
            const catActive = isNodeActive(pathname, cat);
            const hasL4 = cat.children.length > 0;
            return (
              <li key={cat.id} className="mb-5 break-inside-avoid">
                <Link
                  href={normalizeMenuUrl(cat.url)}
                  className={cn(
                    "mb-1.5 flex items-center gap-2 font-body text-13 font-bold uppercase tracking-wide text-foreground no-underline transition-colors duration-150 hover:text-brand",
                    catActive && "text-brand",
                  )}
                  target={cat.openInNewTab ? "_blank" : undefined}
                  rel={cat.openInNewTab ? "noreferrer" : undefined}
                  onClick={onItemClick}
                >
                  {cat.iconUrl && (
                    <span
                      className={submenuIcon}
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
                              "block py-1 font-body text-caption leading-snug text-foreground/75 no-underline transition-colors duration-150 hover:text-brand",
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
// All groups navigate on click (own category page); groups with children also
// switch the right panel on hover/focus so it can be previewed before navigating.

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
  const t = useTranslations("Catalog");
  return (
    <nav
      aria-label={t("filterCategory")}
      className="w-80 shrink-0 border-r border-border bg-[#f9f9f9] py-2 xl:w-[22rem] 3xl:w-96 4xl:w-96"
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
                    "relative flex w-full items-center gap-2.5 px-5 py-2 font-body text-13 font-semibold text-foreground no-underline transition-colors duration-150 hover:bg-white hover:text-brand before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-brand before:opacity-0 before:transition-opacity before:content-['']",
                    groupPathActive && "text-brand before:opacity-100",
                  )}
                  target={group.openInNewTab ? "_blank" : undefined}
                  rel={group.openInNewTab ? "noreferrer" : undefined}
                  onClick={onItemClick}
                  title={group.label}
                >
                  {group.iconUrl && (
                    <span
                      className={submenuIcon}
                      style={{
                        maskImage: `url(${group.iconUrl})`,
                        WebkitMaskImage: `url(${group.iconUrl})`,
                      }}
                      aria-hidden="true"
                    />
                  )}
                  {/* Hiển thị đủ tên danh mục (không cắt …) — cột rộng + leading-snug
                      để tên dài vẫn đọc gọn trong ~2 dòng. */}
                  <span className="min-w-0 flex-1 leading-snug">{group.label}</span>
                </Link>
              </li>
            );
          }

          return (
            <li key={group.id}>
              <Link
                href={normalizeMenuUrl(group.url)}
                className={cn(
                  // Left accent bar uses a before-pseudo (no layout shift on toggle).
                  "relative flex w-full items-center gap-2.5 px-5 py-2 font-body text-13 font-semibold text-foreground no-underline transition-colors duration-150 hover:bg-white hover:text-brand before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-brand before:opacity-0 before:transition-opacity before:content-['']",
                  isActive && "bg-white text-brand before:opacity-100",
                  groupPathActive && "text-brand",
                )}
                target={group.openInNewTab ? "_blank" : undefined}
                rel={group.openInNewTab ? "noreferrer" : undefined}
                onMouseEnter={() => onActivate(group.id)}
                onFocus={() => onActivate(group.id)}
                onClick={onItemClick}
                aria-expanded={isActive}
                title={group.label}
              >
                {group.iconUrl && (
                  <span
                    className={submenuIcon}
                    style={{
                      maskImage: `url(${group.iconUrl})`,
                      WebkitMaskImage: `url(${group.iconUrl})`,
                    }}
                    aria-hidden="true"
                  />
                )}
                <span className="min-w-0 flex-1 text-left leading-snug">{group.label}</span>
                <ChevronRight
                  size={13}
                  strokeWidth={2.5}
                  aria-hidden="true"
                  className={cn(
                    "ml-auto shrink-0 transition-colors duration-150",
                    isActive ? "text-brand" : "text-muted-foreground",
                  )}
                />
              </Link>
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

export function MegaMenu({
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
      // data-dropdown kept as a JS hook (HeaderNavItem reads `[data-dropdown] a`
      // for ArrowDown focus). The legacy [data-dropdown] / .is-visible enter-exit
      // animation (opacity + translateY, was in globals.css) is inlined below.
      // Width hugs content (`w-max`) so sparse category panels don't leave a wide
      // void; the menu is centered in the viewport via `left-1/2` + the
      // `-translate-x-1/2` (v4 `translate` property), independent of the entrance
      // animation's `transform: translateY()`. Width is capped to the viewport.
      data-dropdown
      className={cn(
        "fixed left-1/2 -translate-x-1/2",
        "top-[var(--bb-header-height)]",
        "z-[var(--bb-z-dropdown)]",
        "w-max max-w-[clamp(820px,65vw,1200px)]",
        "max-h-[calc(100vh-var(--bb-header-height)-0.5rem)] overflow-y-auto overflow-x-hidden",
        "bg-white shadow-dropdown",
        "opacity-0 [transform:translateY(6px)] pointer-events-none [transition:opacity_0.2s_ease,transform_0.2s_ease] motion-reduce:[transition-duration:1ms]",
        visible && "opacity-100 [transform:translateY(0px)] pointer-events-auto",
      )}
      role="menu"
      aria-label={node.label}
    >
      <div className="flex">
        <MegaSidebar
          groups={node.children}
          activeId={activeId}
          onActivate={setActiveId}
          onItemClick={onItemClick}
          pathname={pathname}
        />
        <div className="grid">
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
