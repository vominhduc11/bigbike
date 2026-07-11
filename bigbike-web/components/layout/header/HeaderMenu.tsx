"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useLocale } from "next-intl";
import { useState } from "react";

import type { HeaderNavNode } from "@/components/layout/header-nav/shared";
import { Button } from "@/components/ui/button";
import { DEFAULT_LOCALE, type Locale } from "@/i18n/locale";
import { fetchPublicMenu } from "@/lib/api/client-api";
import { cn } from "@/lib/utils";
import { normalizeMenuUrl } from "@/lib/utils/nav";
import { buildPublicMenuTree } from "@/lib/utils/public-menu";
import { translatePath } from "@/lib/utils/routes";
import { submenuIcon } from "@/lib/ui-classes";

type HeaderMenuProps = {
  initialNodes: HeaderNavNode[];
  variant: "desktop" | "mobile";
  onNavigate?: () => void;
};

function filterMenuNodes(nodes: HeaderNavNode[]): HeaderNavNode[] {
  return nodes
    .filter((node) => !node.url?.includes("huong-dan-mua-hang"))
    .map((node) => ({ ...node, children: filterMenuNodes(node.children) }));
}

const itemGroups = ["group/l1", "group/l2", "group/l3"];
const submenuReveal = [
  "group-hover/top:visible group-hover/top:translate-y-0 group-hover/top:opacity-100 group-focus-within/top:visible group-focus-within/top:translate-y-0 group-focus-within/top:opacity-100",
  "group-hover/l1:visible group-hover/l1:translate-x-0 group-hover/l1:opacity-100 group-focus-within/l1:visible group-focus-within/l1:translate-x-0 group-focus-within/l1:opacity-100",
  "group-hover/l2:visible group-hover/l2:translate-x-0 group-hover/l2:opacity-100 group-focus-within/l2:visible group-focus-within/l2:translate-x-0 group-focus-within/l2:opacity-100",
  "group-hover/l3:visible group-hover/l3:translate-x-0 group-hover/l3:opacity-100 group-focus-within/l3:visible group-focus-within/l3:translate-x-0 group-focus-within/l3:opacity-100",
];
const mobileIndent = ["pl-[25px]", "pl-[50px]", "pl-[70px]", "pl-[90px]"];

export function HeaderMenu({ initialNodes, variant, onNavigate }: HeaderMenuProps) {
  const locale = useLocale();
  const isAlt = locale !== DEFAULT_LOCALE;
  const [expanded, setExpanded] = useState<Set<HeaderNavNode["id"]>>(new Set());
  const [suppressedId, setSuppressedId] = useState<HeaderNavNode["id"] | null>(null);
  const { data } = useQuery({
    queryKey: ["header-menu", "primary", locale],
    queryFn: () => fetchPublicMenu("primary", locale).then((res) => buildPublicMenuTree(res.items || [])),
    enabled: isAlt,
    staleTime: 5 * 60 * 1000,
  });
  const nodes = filterMenuNodes(isAlt && data ? data : initialNodes);

  function toggleNode(id: HeaderNavNode["id"]) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (variant === "mobile") {
    return (
      <nav aria-label="Menu chính" className="text-white">
        <MobileMenuList
          nodes={nodes}
          locale={locale}
          expanded={expanded}
          toggleNode={toggleNode}
          onNavigate={onNavigate}
        />
      </nav>
    );
  }

  return (
    <nav aria-label="Menu chính" data-header-desktop-menu className="h-full">
      <ul className="m-0 flex h-full list-none items-center p-0">
        {nodes.map((node) => {
          const href = translatePath(normalizeMenuUrl(node.url) || "/", locale as Locale);
          const hasChildren = node.children.length > 0;
          return (
            <li
              key={node.id}
              data-header-menu-item-with-children={hasChildren ? "" : undefined}
              onMouseLeave={() => setSuppressedId(null)}
              className={cn(
                "group/top relative flex h-full list-none items-center after:absolute after:right-[-3px] after:top-1/2 after:h-[5px] after:w-[5px] after:-translate-y-1/2 after:rotate-45 after:bg-brand-on-dark after:content-[''] last:after:hidden",
                suppressedId === node.id && "[&>[data-header-submenu]]:invisible! [&>[data-header-submenu]]:opacity-0!",
              )}
            >
              <Link
                href={href}
                target={node.openInNewTab ? "_blank" : undefined}
                rel={node.openInNewTab ? "noopener" : undefined}
                onClick={() => setSuppressedId(node.id)}
                className="flex h-full items-center px-[30px] font-cta text-nav font-semibold uppercase text-white! no-underline! transition-colors hover:text-brand-on-dark! focus-visible:text-brand-on-dark!"
              >
                {node.label}
              </Link>
              {hasChildren ? <DesktopSubmenu nodes={node.children} locale={locale} depth={0} /> : null}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function DesktopSubmenu({ nodes, locale, depth }: { nodes: HeaderNavNode[]; locale: string; depth: number }) {
  return (
    <ul
      data-header-submenu
      className={cn(
        "invisible absolute z-[var(--bb-z-dropdown)] m-0 w-[300px] list-none bg-white p-0 opacity-0 shadow-[var(--bb-shadow-dropdown)] transition-[opacity,transform,visibility] duration-200",
        depth === 0 ? "left-0 top-full -translate-y-[10px]" : "left-full top-0 -translate-x-[10px]",
        submenuReveal[Math.min(depth, submenuReveal.length - 1)],
      )}
    >
      {nodes.map((node) => {
        const href = translatePath(normalizeMenuUrl(node.url) || "/", locale as Locale);
        const hasChildren = node.children.length > 0;
        return (
          <li
            key={node.id}
            className={cn(
              "relative border-b border-border last:border-b-0",
              itemGroups[Math.min(depth, itemGroups.length - 1)],
            )}
          >
            <Link href={href} className="flex items-center px-6 py-[14px] font-body text-caption font-semibold normal-case text-muted-foreground! no-underline! hover:text-brand-on-dark!">
              {node.iconUrl ? (
                <span
                  className={`${submenuIcon} mr-2 align-middle`}
                  style={{ maskImage: `url(${node.iconUrl})`, WebkitMaskImage: `url(${node.iconUrl})` }}
                  aria-hidden
                />
              ) : null}
              {node.label}
            </Link>
            {hasChildren ? <DesktopSubmenu nodes={node.children} locale={locale} depth={depth + 1} /> : null}
          </li>
        );
      })}
    </ul>
  );
}

function MobileMenuList({
  nodes,
  locale,
  expanded,
  toggleNode,
  onNavigate,
  depth = 0,
}: {
  nodes: HeaderNavNode[];
  locale: string;
  expanded: Set<HeaderNavNode["id"]>;
  toggleNode: (id: HeaderNavNode["id"]) => void;
  onNavigate?: () => void;
  depth?: number;
}) {
  return (
    <ul className="m-0 list-none p-0">
      {nodes.map((node) => {
        const href = translatePath(normalizeMenuUrl(node.url) || "/", locale as Locale);
        const hasChildren = node.children.length > 0;
        const open = expanded.has(node.id);
        return (
          <li key={node.id} data-header-menu-item-with-children={hasChildren ? "" : undefined} className="relative">
            <Link
              href={href}
              target={node.openInNewTab ? "_blank" : undefined}
              rel={node.openInNewTab ? "noopener" : undefined}
              onClick={onNavigate}
              className={cn(
                "flex min-h-[52px] items-center pr-[70px] text-white! no-underline!",
                mobileIndent[Math.min(depth, mobileIndent.length - 1)],
                depth === 0 ? "py-[15px] font-cta text-body font-semibold uppercase" : "py-[12px] font-body text-caption",
              )}
            >
              {node.label}
            </Link>
            {hasChildren ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                data-header-submenu-trigger
                aria-label={`${open ? "Đóng" : "Mở"} ${node.label}`}
                aria-expanded={open}
                onClick={() => toggleNode(node.id)}
                className="absolute right-2 top-1 min-h-11 w-11 text-white hover:bg-white/10 hover:text-white hover:not-disabled:scale-100"
              >
                <ChevronDown className={cn("h-4 w-4 transition-transform duration-300", open && "rotate-180")} aria-hidden />
              </Button>
            ) : null}
            {hasChildren ? (
              <div
                data-header-submenu
                data-state={open ? "open" : "closed"}
                aria-hidden={!open}
                inert={!open}
                className={cn(
                  "grid overflow-hidden transition-[grid-template-rows,opacity] duration-[var(--bb-duration-slow)] ease-[var(--bb-ease-standard)]",
                  open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                )}
              >
                <div className="min-h-0 overflow-hidden">
                  <MobileMenuList nodes={node.children} locale={locale} expanded={expanded} toggleNode={toggleNode} onNavigate={onNavigate} depth={depth + 1} />
                </div>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
