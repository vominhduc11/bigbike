import Link from "next/link";

export type WpStaticSidebarItem = {
  label: string;
  href: string;
  current?: boolean;
};

/**
 * Sidebar .static-navigation — port 1:1 từ page-static.php / page-guide.php:
 * .col-md-3 > .widget > .widget--body > .static-navigation > ul. Mục đang xem
 * mang class "current" để CSS theme tô nền đỏ giống bản WP gốc.
 */
export function WpStaticSidebar({
  items,
  emptyLabel,
}: {
  items: WpStaticSidebarItem[];
  emptyLabel?: string;
}) {
  return (
    <div className="col-md-3">
      <div className="widget">
        <div className="widget--body">
          <div className="static-navigation">
            {items.length === 0 ? (
              <p>{emptyLabel}</p>
            ) : (
              <ul>
                {items.map((item) => (
                  <li key={item.href} className={item.current ? "current" : undefined}>
                    <Link href={item.href} aria-current={item.current ? "page" : undefined}>
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
