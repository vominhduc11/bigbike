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
  compact = false,
}: {
  items: PolicySidebarItem[];
  emptyLabel?: string;
  compact?: boolean;
}) {
  return (
    <aside className="md:col-span-3">
      {items.length === 0 ? (
        <p className="text-a4-content text-muted-foreground">{emptyLabel}</p>
      ) : (
        <nav aria-label={emptyLabel}>
          <ul
            className={cn(
              "m-0 list-none p-0",
              compact && "flex gap-2 overflow-x-auto pb-2 md:block md:overflow-visible md:pb-0",
            )}
          >
            {items.map((item, index) => (
              <li
                key={item.href}
                className={cn(
                  compact
                    ? "relative shrink-0 border border-border px-3 md:border-0 md:border-b md:px-0 md:py-2 md:pl-5"
                    : "relative border-b border-border py-7 pl-5 first:border-t-0 first:pt-0",
                  item.current && !compact && "pl-8",
                  item.current && compact && "border-brand bg-muted md:bg-transparent",
                )}
              >
                <span
                  className={cn(
                    "absolute left-0 top-9 h-1.5 w-1.5 rotate-45 bg-brand",
                    compact ? "hidden md:top-6 md:block" : index === 0 && "top-2",
                  )}
                  aria-hidden="true"
                />
                <Link
                  href={item.href}
                  aria-current={item.current ? "page" : undefined}
                  className={cn(
                    "font-cta text-b4-action font-semibold uppercase text-foreground hover:text-brand",
                    compact && "inline-flex min-h-11 items-center text-a5-meta md:text-b4-action",
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
