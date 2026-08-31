"use client";

import { ChevronDown } from "lucide-react";
import Link from "@/i18n/StorefrontLink";
import { useLocale, useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { useState, type MouseEventHandler, type ReactNode } from "react";

import {
  getHeaderNodeHref,
  isNodeActive,
  isNodeCurrent,
  type HeaderNavNode,
} from "@/components/layout/header-nav/shared";
import { Button } from "@/components/ui/button";
import { type Locale } from "@/i18n/locale";
import { cn } from "@/lib/utils";
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

type HeaderMenuLinkProps = {
  node: HeaderNavNode;
  href: string;
  newWindowLabel: string;
  className: string;
  children: ReactNode;
  current?: boolean;
  ariaHasPopup?: "menu";
  ariaExpanded?: boolean;
  title?: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
};

/** Every storefront menu link shares the new-window announcement so admin can
 * enable that setting on any level without creating an inaccessible exception. */
function HeaderMenuLink({
  node,
  href,
  newWindowLabel,
  className,
  children,
  current,
  ariaHasPopup,
  ariaExpanded,
  title,
  onClick,
}: HeaderMenuLinkProps) {
  return (
    <Link
      href={href}
      target={node.openInNewTab ? "_blank" : undefined}
      rel={node.openInNewTab ? "noopener" : undefined}
      aria-current={current ? "page" : undefined}
      aria-haspopup={ariaHasPopup}
      aria-expanded={ariaExpanded}
      title={title}
      onClick={onClick}
      className={className}
    >
      {children}
      {node.openInNewTab ? <span className="sr-only"> ({newWindowLabel})</span> : null}
    </Link>
  );
}

export function HeaderMenu({ initialNodes, variant, onNavigate }: HeaderMenuProps) {
  const locale = useLocale() as Locale;
  const pathname = usePathname();
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
          pathname={pathname}
          newWindowLabel={t("opensInNewWindow")}
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
          const href = getHeaderNodeHref(node, locale);
          const hasChildren = node.children.length > 0;
          const open = openNodeId === node.id;
          const active = isNodeActive(pathname, node, locale);
          const current = isNodeCurrent(pathname, node, locale);
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
              <HeaderMenuLink
                node={node}
                href={href}
                newWindowLabel={t("opensInNewWindow")}
                current={current}
                ariaHasPopup={hasChildren ? "menu" : undefined}
                ariaExpanded={hasChildren ? open : undefined}
                onClick={() => setOpenNodeId(null)}
                className={cn(
                  "flex h-full shrink-0 items-center whitespace-nowrap px-5 font-cta text-header-nav font-bold leading-body tracking-wide no-underline! transition-colors min-[1440px]:px-6",
                  active
                    ? "text-brand-on-dark! hover:text-brand-on-dark! focus-visible:text-brand-on-dark!"
                    : "text-white! hover:text-brand-on-dark! focus-visible:text-brand-on-dark!",
                )}
              >
                {node.label}
              </HeaderMenuLink>
              {hasChildren ? (
                <DesktopSubmenu
                  nodes={node.children}
                  locale={locale}
                  pathname={pathname}
                  depth={0}
                  open={open}
                  onNavigate={() => setOpenNodeId(null)}
                  newWindowLabel={t("opensInNewWindow")}
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
  pathname,
  depth,
  open,
  onNavigate,
  newWindowLabel,
}: {
  nodes: HeaderNavNode[];
  locale: Locale;
  pathname: string | null;
  depth: number;
  open?: boolean;
  onNavigate: () => void;
  newWindowLabel: string;
}) {
  return (
    <ul
      data-header-submenu
      data-header-submenu-depth={depth}
      className={cn(
        "invisible absolute z-[var(--bb-z-dropdown)] m-0 w-80 list-none bg-white p-0 opacity-0 shadow-[var(--bb-shadow-dropdown)] transition-[opacity,transform,visibility] duration-200",
        depth === 0 ? "left-0 top-full -translate-y-[10px]" : "left-full top-0 -translate-x-[10px]",
        depth === 0 && open && "visible translate-y-0 opacity-100",
        submenuReveal[Math.min(depth, submenuReveal.length - 1)],
      )}
    >
      {nodes.map((node) => {
        const href = getHeaderNodeHref(node, locale);
        const hasChildren = node.children.length > 0;
        const active = isNodeActive(pathname, node, locale);
        const current = isNodeCurrent(pathname, node, locale);
        return (
          <li
            key={node.id}
            className={cn(
              "relative border-b border-border last:border-b-0",
              itemGroups[Math.min(depth, itemGroups.length - 1)],
            )}
          >
            <HeaderMenuLink
              node={node}
              href={href}
              newWindowLabel={newWindowLabel}
              current={current}
              title={node.label}
              onClick={onNavigate}
              className={cn(
                "flex h-11 min-w-0 items-center px-6 font-body text-a5-meta font-semibold normal-case no-underline! hover:text-brand-on-dark!",
                active ? "text-brand-on-dark!" : "text-muted-foreground!",
              )}
            >
              {node.iconUrl && depth === 0 ? (
                <span
                  data-header-submenu-icon
                  data-header-submenu-icon-depth={depth}
                  className={`${submenuIcon} mr-2 align-middle`}
                  style={{
                    maskImage: `url(${node.iconUrl})`,
                    WebkitMaskImage: `url(${node.iconUrl})`,
                  }}
                  aria-hidden
                />
              ) : null}
              <span data-header-menu-label className="min-w-0 flex-1 truncate">
                {node.label}
              </span>
            </HeaderMenuLink>
            {hasChildren ? (
              <DesktopSubmenu
                nodes={node.children}
                locale={locale}
                pathname={pathname}
                depth={depth + 1}
                onNavigate={onNavigate}
                newWindowLabel={newWindowLabel}
              />
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
  pathname,
  newWindowLabel,
  depth = 0,
  expandLabel,
  collapseLabel,
}: {
  nodes: HeaderNavNode[];
  locale: Locale;
  expanded: Set<HeaderNavNode["id"]>;
  toggleNode: (id: HeaderNavNode["id"]) => void;
  onNavigate?: () => void;
  pathname: string | null;
  newWindowLabel: string;
  depth?: number;
  expandLabel: string;
  collapseLabel: string;
}) {
  return (
    <ul className="m-0 list-none p-0">
      {nodes.map((node) => {
        const href = getHeaderNodeHref(node, locale);
        const hasChildren = node.children.length > 0;
        const open = expanded.has(node.id);
        const active = isNodeActive(pathname, node, locale);
        const current = isNodeCurrent(pathname, node, locale);
        return (
          <li
            key={node.id}
            data-header-menu-item-with-children={hasChildren ? "" : undefined}
            className="relative"
          >
            <HeaderMenuLink
              node={node}
              href={href}
              newWindowLabel={newWindowLabel}
              current={current}
              onClick={(event) => {
                if (
                  node.openInNewTab ||
                  event.metaKey ||
                  event.ctrlKey ||
                  event.shiftKey ||
                  event.altKey
                )
                  return;
                onNavigate?.();
              }}
              className={cn(
                "flex min-h-13 min-w-0 items-start whitespace-normal pr-17.5 no-underline!",
                mobileIndent[Math.min(depth, mobileIndent.length - 1)],
                depth === 0
                  ? "py-[15px] font-cta text-header-nav font-bold leading-body tracking-wide"
                  : "py-3 font-body text-a5-meta",
                active ? "text-brand-on-dark!" : "text-white!",
              )}
            >
              {node.iconUrl && depth === 1 ? (
                <span
                  data-header-submenu-icon
                  data-header-submenu-icon-depth={depth}
                  className={`${submenuIcon} mr-2 mt-1`}
                  style={{
                    maskImage: `url(${node.iconUrl})`,
                    WebkitMaskImage: `url(${node.iconUrl})`,
                  }}
                  aria-hidden
                />
              ) : null}
              <span data-header-menu-label className="min-w-0 flex-1 break-words">
                {node.label}
              </span>
            </HeaderMenuLink>
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
                <ChevronDown
                  className={cn("h-4 w-4 transition-transform duration-300", open && "rotate-180")}
                  aria-hidden
                />
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
                  <MobileMenuList
                    nodes={node.children}
                    locale={locale}
                    expanded={expanded}
                    toggleNode={toggleNode}
                    onNavigate={onNavigate}
                    pathname={pathname}
                    newWindowLabel={newWindowLabel}
                    depth={depth + 1}
                    expandLabel={expandLabel}
                    collapseLabel={collapseLabel}
                  />
                </div>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
