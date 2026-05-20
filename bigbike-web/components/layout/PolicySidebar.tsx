import Link from "next/link";
import { getTranslations } from "next-intl/server";

export type PolicySidebarItem = {
  label: string;
  href: string;
};

type Props = {
  activeHref?: string;
  title?: string;
  items?: PolicySidebarItem[];
};

export async function PolicySidebar({ activeHref, title, items }: Props) {
  const t = await getTranslations("StaticPage");
  const resolvedTitle = title ?? t("policy.sidebarTitle");
  const resolvedItems = items ?? [
    { label: t("policy.privacyTitle"), href: "/chinh-sach/bao-mat" },
    { label: t("policy.warrantyTitle"), href: "/chinh-sach/bao-hanh" },
    { label: t("policy.returnsTitle"), href: "/chinh-sach/doi-tra" },
    { label: t("policy.termsTitle"), href: "/chinh-sach/dieu-khoan" },
    { label: t("howToBuy.title"), href: "/huong-dan-mua-hang" },
  ];

  return (
    <aside className="min-w-0" aria-label={resolvedTitle}>
      <h3 className="font-display text-base font-semibold uppercase text-foreground mb-4 pb-3 border-b-2 border-brand tracking-normal">
        {resolvedTitle}
      </h3>
      <ul className="list-none p-0 m-0">
        {resolvedItems.map((item) => {
          const active = activeHref === item.href;
          return (
            <li key={item.href} className="border-b border-border">
              <Link
                href={item.href}
                className={`block py-3 font-body text-sm no-underline uppercase tracking-[0.02em] transition-all duration-150 hover:text-brand hover:pl-1.5 ${
                  active ? "text-brand font-semibold" : "text-foreground"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
