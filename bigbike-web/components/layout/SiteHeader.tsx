import Image from "next/image";
import Link from "next/link";
import { CartIcon } from "@/components/cart/CartIcon";
import { toAccountPath } from "@/lib/utils/routes";

const links = [
  { href: "/", label: "Trang chủ" },
  { href: "/san-pham", label: "Sản phẩm" },
  { href: "/danh-muc-san-pham", label: "Danh mục" },
  { href: "/brands", label: "Thương hiệu" },
  { href: "/tin-tuc", label: "Tin tức" },
];

export function SiteHeader() {
  return (
    <header className="bb-header">
      <div className="bb-container bb-header-inner">
        <Link href="/" className="bb-logo-link" aria-label="BigBike Home">
          <Image
            src="/brand/logo/PNG/01/BIGBIKE_FINAL_LOGO-01.png"
            alt="BigBike"
            width={184}
            height={48}
            priority
          />
        </Link>

        <nav className="bb-nav" aria-label="Điều hướng chính">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="bb-nav-link">
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="bb-header-actions">
          <Link href={toAccountPath()} className="bb-nav-link">
            Tài khoản
          </Link>
          <CartIcon />
        </div>
      </div>
    </header>
  );
}
