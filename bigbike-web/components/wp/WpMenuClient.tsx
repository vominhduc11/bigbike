"use client";

import { useLocale } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { DEFAULT_LOCALE } from "@/i18n/locale";
import { fetchPublicMenu } from "@/lib/api/client-api";
import { buildPublicMenuTree } from "@/lib/utils/public-menu";
import type { HeaderNavNode } from "@/components/layout/header-nav/shared";
import Link from "next/link";
import { normalizeMenuUrl } from "@/lib/utils/nav";
import { submenuIcon } from "@/lib/ui-classes";
import { getStaticPage, getGuideLayout } from "@/lib/content/static-pages";

type WpMenuClientProps = {
  initialNodes: HeaderNavNode[];
  location: "primary" | "footer";
  top?: boolean;
};

function filterMenuNodes(nodes: HeaderNavNode[]): HeaderNavNode[] {
  return nodes
    .filter((node) => {
      const url = node.url || "";
      return !url.includes("huong-dan-mua-hang") && !url.includes("cac-dieu-kien-va-dieu-khoan");
    })
    .map((node) => ({
      ...node,
      children: filterMenuNodes(node.children),
    }));
}

export function WpMenuClient({ initialNodes, location, top = false }: WpMenuClientProps) {
  const locale = useLocale();
  const isAlt = locale !== DEFAULT_LOCALE;

  const { data } = useQuery({
    queryKey: ["wp-menu", location, locale],
    queryFn: () => fetchPublicMenu(location, locale).then((res) => buildPublicMenuTree(res.items || [])),
    enabled: isAlt,
    staleTime: 5 * 60 * 1000,
  });

  const rawNodes = isAlt && data ? data : initialNodes;
  const filteredNodes = filterMenuNodes(rawNodes);

  if (location === "footer") {
    // Merge essential items in footer
    const returnPage = getStaticPage("chinh-sach-doi-tra-hang", locale);
    const warrantyPage = getStaticPage("chinh-sach-bao-hanh", locale);
    const privacyPage = getStaticPage("chinh-sach-bao-mat-thong-tin", locale);
    
    const guideLayout = getGuideLayout(locale);
    const sizeMuEntry = guideLayout.entries.find((e) => e.pageSlug === "cach-do-size-dau");
    const sizeTrangPhucEntry = guideLayout.entries.find((e) => e.pageSlug === "cach-do-size-trang-phuc");

    const essentialItems = [
      {
        href: "/chinh-sach/chinh-sach-doi-tra-hang/",
        label: returnPage?.title || (locale === "en" ? "Return Policy" : "Chính sách đổi trả hàng"),
      },
      {
        href: "/chinh-sach/chinh-sach-bao-hanh/",
        label: warrantyPage?.title || (locale === "en" ? "Warranty Policy" : "Chính sách bảo hành"),
      },
      {
        href: "/chinh-sach/chinh-sach-bao-mat-thong-tin/",
        label: privacyPage?.title || (locale === "en" ? "Privacy Policy" : "Chính sách bảo mật thông tin"),
      },
      {
        href: "/huong-dan/size-mu/",
        label: sizeMuEntry?.title || (locale === "en" ? "Helmet Sizing Guide" : "Cách xác định size mũ bảo hiểm"),
      },
      {
        href: "/huong-dan/size-trang-phuc/",
        label: sizeTrangPhucEntry?.title || (locale === "en" ? "Clothing Sizing Guide" : "Cách đo size trang phục bảo hộ"),
      },
    ];

    const normalizedFooterHrefs = new Set(
      filteredNodes.map((node) => normalizeMenuUrl(node.url))
    );

    const additionalNodes = essentialItems
      .filter((item) => !normalizedFooterHrefs.has(item.href))
      .map((item, index) => ({
        id: `essential-fallback-${index}`,
        parentId: null,
        label: item.label,
        url: item.href,
        sortOrder: 100 + index,
        openInNewTab: false,
        cssClass: null,
        children: [],
      }));

    const mergedFooterNodes = [...filteredNodes, ...additionalNodes];

    return (
      <ul className="menu">
        {mergedFooterNodes.map((node) => {
          const href = normalizeMenuUrl(node.url) || "/";
          return (
            <li key={node.id} className="menu-item">
              <Link href={href} target={node.openInNewTab ? "_blank" : undefined}>
                {node.label}
              </Link>
            </li>
          );
        })}
      </ul>
    );
  }

  // Header menu recursive render
  return <WpMenuRecursive nodes={filteredNodes} top={top} />;
}

function WpMenuRecursive({ nodes, top = false }: { nodes: HeaderNavNode[]; top?: boolean }) {
  return (
    <ul className={top ? "header-nav" : "sub-menu"}>
      {nodes.map((node) => {
        const href = normalizeMenuUrl(node.url) || "/";
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
            {hasChildren && <WpMenuRecursive nodes={node.children} />}
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
