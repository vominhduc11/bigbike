import Link from "next/link";

export type PolicySidebarItem = {
  label: string;
  href: string;
};

export const POLICY_LINKS: PolicySidebarItem[] = [
  { label: "Chính sách bảo mật thông tin", href: "/chinh-sach/bao-mat" },
  { label: "Chính sách bảo hành", href: "/bao-hanh" },
  { label: "Chính sách đổi trả hàng", href: "/chinh-sach/doi-tra" },
  { label: "Điều khoản sử dụng", href: "/chinh-sach/dieu-khoan" },
  { label: "Hướng dẫn mua hàng", href: "/huong-dan-mua-hang" },
];

type Props = {
  activeHref?: string;
  title?: string;
  items?: PolicySidebarItem[];
};

export function PolicySidebar({ activeHref, title = "TRANG TĨNH", items = POLICY_LINKS }: Props) {
  return (
    <aside className="min-w-0" aria-label={title}>
      <h3 className="font-display text-base font-semibold uppercase text-foreground mb-4 pb-3 border-b-2 border-brand tracking-normal">
        {title}
      </h3>
      <ul className="list-none p-0 m-0">
        {items.map((item) => {
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
