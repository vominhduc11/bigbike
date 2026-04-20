import Image from "next/image";
import Link from "next/link";

const links = [
  { href: "/", label: "Trang chu" },
  { href: "/san-pham", label: "San pham" },
  { href: "/danh-muc-san-pham", label: "Danh muc" },
  { href: "/brands", label: "Thuong hieu" },
  { href: "/tin-tuc", label: "Tin tuc" },
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

        <nav className="bb-nav" aria-label="Dieu huong chinh">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="bb-nav-link">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

