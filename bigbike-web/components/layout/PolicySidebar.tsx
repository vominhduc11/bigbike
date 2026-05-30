import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getPublicMenu } from "@/lib/api/public-api";
import { flattenPublicMenuTree, buildPublicMenuTree } from "@/lib/utils/public-menu";
import { normalizeMenuUrl } from "@/lib/utils/nav";

export type PolicySidebarItem = {
  label: string;
  href: string;
};

type Props = {
  activeHref?: string;
  title?: string;
  items?: PolicySidebarItem[];
};

const GUIDE_MENU_LOCATION = "guide";

export async function PolicySidebar({ activeHref, title, items }: Props) {
  const t = await getTranslations("StaticPage");
  const resolvedTitle = title ?? t("policy.sidebarTitle");

  const menuResult = items
    ? null
    : await getPublicMenu(GUIDE_MENU_LOCATION);

  if (!items && menuResult && !menuResult.data) {
    console.warn(
      `[PolicySidebar] Menu "${GUIDE_MENU_LOCATION}" could not be loaded.`,
      menuResult.error?.message ?? "unknown error",
    );
  }

  const resolvedItems = items ?? flattenPublicMenuTree(
    buildPublicMenuTree(menuResult?.data?.items ?? []),
  ).map((item) => ({
    label: item.label,
    href: normalizeMenuUrl(item.url),
  }));

  return (
    <aside className="min-w-0" aria-label={resolvedTitle}>
      <h3 className="mb-4 border-b-2 border-brand pb-3 font-display text-base font-semibold uppercase text-foreground tracking-normal">
        {resolvedTitle}
      </h3>
      {resolvedItems.length > 0 ? (
        <ul className="m-0 list-none p-0">
          {resolvedItems.map((item) => {
            const active = activeHref === item.href;
            return (
              <li key={item.href} className="border-b border-border">
                <Link
                  href={item.href}
                  className={`block py-3 font-body text-sm uppercase tracking-wide no-underline transition-all duration-150 hover:pl-1.5 hover:text-brand ${
                    active ? "font-semibold text-brand" : "text-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </aside>
  );
}
