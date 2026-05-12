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
    <aside className="wp-static-sidebar" aria-label={title}>
      <h3 className="wp-static-sidebar-title">{title}</h3>
      <ul className="wp-static-navigation">
        {items.map((item) => {
          const active = activeHref === item.href;
          return (
            <li key={item.href} className={active ? "current" : ""}>
              <Link href={item.href}>{item.label}</Link>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
