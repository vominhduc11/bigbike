import type { PublicMenuItem } from "@/lib/contracts/public";
import { normalizeMenuUrl, isActivePath } from "@/lib/utils/nav";
import type { Locale } from "@/i18n/locale";
import { localizeStorefrontHref } from "@/lib/utils/routes";

export type HeaderNavNode = PublicMenuItem & { children: HeaderNavNode[] };

export function getHeaderNodeHref(node: HeaderNavNode, locale: Locale): string {
  return localizeStorefrontHref(normalizeMenuUrl(node.url) || "/", locale);
}

/** `aria-current` is reserved for the exact current page; ancestors are styled
 * active separately so a category parent is not announced as the page itself. */
export function isNodeCurrent(
  pathname: string | null,
  node: HeaderNavNode,
  locale: Locale,
): boolean {
  const href = getHeaderNodeHref(node, locale);
  if (!pathname || !href.startsWith("/")) return false;

  const withoutTrailingSlash = (value: string) =>
    value === "/" ? value : value.replace(/\/+$/, "");
  return withoutTrailingSlash(pathname) === withoutTrailingSlash(href);
}

/** Node "đang active" nếu chính nó hoặc bất kỳ con/cháu nào khớp đường dẫn hiện tại. */
export function isNodeActive(
  pathname: string | null,
  node: HeaderNavNode,
  locale: Locale,
): boolean {
  if (isActivePath(pathname, getHeaderNodeHref(node, locale))) return true;
  return node.children.some((child) => isNodeActive(pathname, child, locale));
}
