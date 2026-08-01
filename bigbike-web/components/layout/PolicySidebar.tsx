import Link from "@/i18n/StorefrontLink";
import { cn } from "@/lib/utils";

export type PolicySidebarItem = {
  label: string;
  href: string;
  current?: boolean;
};

export function PolicySidebar({
  items,
  emptyLabel,
}: {
  items: PolicySidebarItem[];
  emptyLabel?: string;
}) {
  return (
    <aside className="md:col-span-3">
      {items.length === 0 ? (
        <p className="text-a4-content text-muted-foreground">{emptyLabel}</p>
      ) : (
        <nav aria-label={emptyLabel}>
          <ul className="m-0 list-none p-0">
            {items.map((item, index) => (
              <li
                key={item.href}
                className={cn(
                  "relative border-b border-border py-7 pl-5 first:border-t-0 first:pt-0",
                  item.current && "pl-8",
                )}
              >
                <span
                  className={cn(
                    "absolute left-0 top-9 h-1.5 w-1.5 rotate-45 bg-brand",
                    index === 0 && "top-2",
                  )}
                  aria-hidden="true"
                />
                <Link
                  href={item.href}
                  aria-current={item.current ? "page" : undefined}
                  className={cn(
                    "font-cta text-b4-action font-semibold uppercase text-foreground hover:text-brand",
                    item.current && "text-brand",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </aside>
  );
}
