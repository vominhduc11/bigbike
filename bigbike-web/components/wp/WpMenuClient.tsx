"use client";

import { useLocale } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { DEFAULT_LOCALE, type Locale } from "@/i18n/locale";
import { fetchPublicMenu } from "@/lib/api/client-api";
import { buildPublicMenuTree } from "@/lib/utils/public-menu";
import type { HeaderNavNode } from "@/components/layout/header-nav/shared";
import Link from "next/link";
import { normalizeMenuUrl } from "@/lib/utils/nav";
import { submenuIcon } from "@/lib/ui-classes";
import { translatePath } from "@/lib/utils/routes";

type WpMenuClientProps = {
  initialNodes: HeaderNavNode[];
  top?: boolean;
};

function filterMenuNodes(nodes: HeaderNavNode[]): HeaderNavNode[] {
  return nodes
    .filter((node) => {
      const url = node.url || "";
      return !url.includes("huong-dan-mua-hang");
    })
    .map((node) => ({
      ...node,
      children: filterMenuNodes(node.children),
    }));
}

/** Menu header (primary) — client vì re-fetch theo locale khi khác locale mặc định. */
export function WpMenuClient({ initialNodes, top = false }: WpMenuClientProps) {
  const locale = useLocale();
  const isAlt = locale !== DEFAULT_LOCALE;

  const { data } = useQuery({
    queryKey: ["wp-menu", "primary", locale],
    queryFn: () => fetchPublicMenu("primary", locale).then((res) => buildPublicMenuTree(res.items || [])),
    enabled: isAlt,
    staleTime: 5 * 60 * 1000,
  });

  const rawNodes = isAlt && data ? data : initialNodes;
  const filteredNodes = filterMenuNodes(rawNodes);

  return <WpMenuRecursive nodes={filteredNodes} top={top} locale={locale} />;
}

function WpMenuRecursive({ nodes, top = false, locale }: { nodes: HeaderNavNode[]; top?: boolean; locale: string }) {
  return (
    <ul className={top ? "header-nav" : "sub-menu"}>
      {nodes.map((node) => {
        const rawHref = normalizeMenuUrl(node.url) || "/";
        const href = translatePath(rawHref, locale as Locale);
        const hasChildren = node.children && node.children.length > 0;
        const target = node.openInNewTab ? "_blank" : undefined;

        const liClass =
          (top ? "navigation--item menu-item" : "menu-item") +
          (hasChildren ? " menu-item-has-children" : "");
        return (
          <li key={node.id} className={liClass}>
            <Link href={href} target={target} rel={target ? "noopener" : undefined}>
              {!top && node.iconUrl && (
                <span
                  className={`${submenuIcon} mr-2 align-middle`}
                  style={{
                    maskImage: `url(${node.iconUrl})`,
                    WebkitMaskImage: `url(${node.iconUrl})`,
                  }}
                  aria-hidden="true"
                />
              )}
              {node.label}
            </Link>
            {hasChildren && <WpMenuRecursive nodes={node.children} locale={locale} />}
            {hasChildren && (
              <div className="arrow">
                <i className="fal fa-chevron-down" />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
