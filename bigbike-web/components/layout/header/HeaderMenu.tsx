"use client";

import { ChevronDown } from "lucide-react";
import Link from "@/i18n/StorefrontLink";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import type { HeaderNavNode } from "@/components/layout/header-nav/shared";
import { Button } from "@/components/ui/button";
import { type Locale } from "@/i18n/locale";
import { cn } from "@/lib/utils";
import { normalizeMenuUrl } from "@/lib/utils/nav";
import { localizeStorefrontHref } from "@/lib/utils/routes";
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
  "",
  "group-hover/l1:visible group-hover/l1:translate-x-0 group-hover/l1:opacity-100 group-focus-within/l1:visible group-focus-within/l1:translate-x-0 group-focus-within/l1:opacity-100",
  "group-hover/l2:visible group-hover/l2:translate-x-0 group-hover/l2:opacity-100 group-focus-within/l2:visible group-focus-within/l2:translate-x-0 group-focus-within/l2:opacity-100",
  "group-hover/l3:visible group-hover/l3:translate-x-0 group-hover/l3:opacity-100 group-focus-within/l3:visible group-focus-within/l3:translate-x-0 group-focus-within/l3:opacity-100",
];
const mobileIndent = ["pl-[25px]", "pl-12.5", "pl-17.5", "pl-22.5"];

export function HeaderMenu({ initialNodes, variant, onNavigate }: HeaderMenuProps) {
  const locale = useLocale();
  const t = useTranslations("Header");
  const [expanded, setExpanded] = useState<Set<HeaderNavNode["id"]>>(new Set());
  const [openNodeId, setOpenNodeId] = useState<HeaderNavNode["id"] | null>(null);
  const nodes = filterMenuNodes(initialNodes);

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
      <nav aria-label={t("menu")} className="text-white">
        <MobileMenuList
          nodes={nodes}
          locale={locale}
          expanded={expanded}
          toggleNode={toggleNode}
          onNavigate={onNavigate}
          expandLabel={t("mobileMenuExpandAriaLabel", { label: "{label}" })}
          collapseLabel={t("mobileMenuCollapseAriaLabel", { label: "{label}" })}
        />
      </nav>
    );
  }

  return (
    <nav
      aria-label={t("menu")}
      data-header-desktop-menu
      className="h-full shrink-0"
      onPointerLeave={() => setOpenNodeId(null)}
      onBlur={(event) => {
        const nextTarget = event.relatedTarget;
        if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
          setOpenNodeId(null);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpenNodeId(null);
      }}
    >
      <ul className="m-0 flex h-full w-max list-none items-center p-0">
        {nodes.map((node) => {
          const href = localizeStorefrontHref(normalizeMenuUrl(node.url) || "/", locale as Locale);
          const hasChildren = node.children.length > 0;
          const open = openNodeId === node.id;
          return (
            <li
              key={node.id}
              data-header-menu-item-with-children={hasChildren ? "" : undefined}
              onPointerEnter={() => setOpenNodeId(hasChildren ? node.id : null)}
              onFocus={() => setOpenNodeId(hasChildren ? node.id : null)}
              className={cn(
                "relative flex h-full shrink-0 list-none items-center after:absolute after:right-[-3px] after:top-1/2 after:h-[5px] after:w-[5px] after:-translate-y-1/2 after:rotate-45 after:bg-brand-on-dark after:content-[''] last:after:hidden",
              )}
            >
              <Link
                href={href}
                target={node.openInNewTab ? "_blank" : undefined}
                rel={node.openInNewTab ? "noopener" : undefined}
                aria-haspopup={hasChildren ? "menu" : undefined}
                aria-expanded={hasChildren ? open : undefined}
                onClick={() => setOpenNodeId(null)}
                className="flex h-full shrink-0 items-center whitespace-nowrap px-7.5 font-cta text-header-nav font-bold leading-body tracking-wide text-white! no-underline! transition-colors hover:text-brand-on-dark! focus-visible:text-brand-on-dark!"
              >
                {node.label}
              </Link>
              {hasChildren ? (
                <DesktopSubmenu
                  nodes={node.children}
                  locale={locale}
                  depth={0}
                  open={open}
                  onNavigate={() => setOpenNodeId(null)}
                />
              ) : null}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function DesktopSubmenu({
  nodes,
  locale,
  depth,
  open,
  onNavigate,
}: {
  nodes: HeaderNavNode[];
  locale: string;
  depth: number;
  open?: boolean;
  onNavigate: () => void;
}) {
  return (
    <ul
      data-header-submenu
      className={cn(
        "invisible absolute z-[var(--bb-z-dropdown)] m-0 w-75 list-none bg-white p-0 opacity-0 shadow-[var(--bb-shadow-dropdown)] transition-[opacity,transform,visibility] duration-200",
        depth === 0 ? "left-0 top-full -translate-y-[10px]" : "left-full top-0 -translate-x-[10px]",
        depth === 0 && open && "visible translate-y-0 opacity-100",
        submenuReveal[Math.min(depth, submenuReveal.length - 1)],
      )}
    >
      {nodes.map((node) => {
        const href = localizeStorefrontHref(normalizeMenuUrl(node.url) || "/", locale as Locale);
        const hasChildren = node.children.length > 0;
        return (
          <li
            key={node.id}
            className={cn(
              "relative border-b border-border last:border-b-0",
              itemGroups[Math.min(depth, itemGroups.length - 1)],
            )}
          >
            <Link
              href={href}
              onClick={onNavigate}
              className="flex items-center px-6 py-3.5 font-body text-a5-meta font-semibold normal-case text-muted-foreground! no-underline! hover:text-brand-on-dark!"
            >
              {node.iconUrl ? (
                <span
                  data-header-submenu-icon
                  className={`${submenuIcon} mr-2 align-middle`}
                  style={{ maskImage: `url(${node.iconUrl})`, WebkitMaskImage: `url(${node.iconUrl})` }}
                  aria-hidden
                />
              ) : null}
              {node.label}
            </Link>
            {hasChildren ? (
              <DesktopSubmenu nodes={node.children} locale={locale} depth={depth + 1} onNavigate={onNavigate} />
            ) : null}
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
  expandLabel,
  collapseLabel,
}: {
  nodes: HeaderNavNode[];
  locale: string;
  expanded: Set<HeaderNavNode["id"]>;
  toggleNode: (id: HeaderNavNode["id"]) => void;
  onNavigate?: () => void;
  depth?: number;
  expandLabel: string;
  collapseLabel: string;
}) {
  return (
    <ul className="m-0 list-none p-0">
      {nodes.map((node) => {
        const href = localizeStorefrontHref(normalizeMenuUrl(node.url) || "/", locale as Locale);
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
                "flex min-h-13 items-center whitespace-nowrap pr-17.5 text-white! no-underline!",
                mobileIndent[Math.min(depth, mobileIndent.length - 1)],
                depth === 0
                  ? "py-[15px] font-cta text-header-nav font-bold leading-body tracking-wide"
                  : "py-3 font-body text-a5-meta",
              )}
            >
              {node.iconUrl ? (
                <span
                  data-header-submenu-icon
                  className={`${submenuIcon} mr-2 align-middle`}
                  style={{ maskImage: `url(${node.iconUrl})`, WebkitMaskImage: `url(${node.iconUrl})` }}
                  aria-hidden
                />
              ) : null}
              {node.label}
            </Link>
            {hasChildren ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                data-header-submenu-trigger
                aria-label={(open ? collapseLabel : expandLabel).replace("{label}", node.label)}
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
                  <MobileMenuList nodes={node.children} locale={locale} expanded={expanded} toggleNode={toggleNode} onNavigate={onNavigate} depth={depth + 1} expandLabel={expandLabel} collapseLabel={collapseLabel} />
                </div>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
