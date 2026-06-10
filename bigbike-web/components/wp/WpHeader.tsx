import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { getLocale } from "next-intl/server";
import type { HeaderNavNode } from "@/components/layout/HeaderNavItem";
import { listPublicSettings } from "@/lib/api/public-api";
import { normalizeMenuUrl } from "@/lib/utils/nav";
import { WpSearchIcon } from "./WpSearchIcon";
import { pickSetting } from "@/lib/utils/settings";
import { toCartPath } from "@/lib/utils/routes";
import { WpCartCount } from "./WpCartCount";
import { WpHeaderUser } from "./WpHeaderUser";
import { WpLangSwitch } from "./WpLangSwitch";
import { WpMegaNavItem } from "./WpMegaNavItem";

const T = "/wp-content/themes/bigbike";

/**
 * Khối "Thông tin liên hệ" — xuất hiện ở cả mobile-item lẫn drawer
 * information-slide-bigbike (markup .contact-me giống hệt nhau trong header.php).
 * Giờ làm + nhãn cửa hàng là copy cố định của theme; địa chỉ + SĐT lấy từ settings.
 */
function WpContactMe({ address, phones }: { address: string; phones: string[] }) {
  return (
    <div className="contact-me">
      <p className="title-contact-me">Thông tin liên hệ</p>
      <ul>
        <li>
          <div className="row">
            <div className="col icon">
              <i className="fal fa-clock" />
            </div>
            <div className="col">
              <p>T2 - T6: 09h00 - 21h00</p>
              <p>T7 / CN: 09h00 - 18h00</p>
              <p>Lễ / Tết: nghỉ</p>
            </div>
          </div>
        </li>
        {address ? (
          <li>
            <div className="row">
              <div className="col icon">
                <i className="fal fa-map-marker-alt" />
              </div>
              <div className="col">
                <p>Cửa hàng Bigbike</p>
                <p>{address}</p>
              </div>
            </div>
          </li>
        ) : null}
        {phones.length > 0 ? (
          <li>
            <div className="row">
              <div className="col icon">
                <i className="fal fa-clock" />
              </div>
              <div className="col">
                {phones.map((phone) => (
                  <p key={phone}>{phone}</p>
                ))}
              </div>
            </div>
          </li>
        ) : null}
      </ul>
    </div>
  );
}

function WpMenu({ nodes, top = false }: { nodes: HeaderNavNode[]; top?: boolean }) {
  // Khớp DOM wp_nav_menu gốc: ul top = .header-nav, li top có .navigation--item;
  // submenu = ul.sub-menu, li chỉ .menu-item. CSS theme tô màu nav qua các class này.
  return (
    <ul className={top ? "header-nav" : "sub-menu"}>
      {nodes.map((node) => {
        const href = normalizeMenuUrl(node.url) || "/";
        const hasChildren = node.children.length > 0;
        const target = node.openInNewTab ? "_blank" : undefined;

        // Item cấp 1 có submenu (chỉ "Tất cả sản phẩm") → mega menu trên desktop;
        // .sub-menu lồng truyền qua children để off-canvas mobile dùng như cũ.
        if (top && hasChildren) {
          return (
            <WpMegaNavItem key={node.id} node={node}>
              <WpMenu nodes={node.children} />
            </WpMegaNavItem>
          );
        }

        const liClass =
          (top ? "navigation--item menu-item" : "menu-item") +
          (hasChildren ? " menu-item-has-children" : "");
        return (
          <li key={node.id} className={liClass}>
            <Link href={href} target={target} rel={target ? "noopener" : undefined}>
              {node.label}
            </Link>
            {hasChildren && <WpMenu nodes={node.children} />}
          </li>
        );
      })}
    </ul>
  );
}

/** Header WordPress bigbike.vn — port 1:1 từ header.php; menu + thông tin liên hệ
 * (địa chỉ / SĐT) lấy từ settings công khai, KHÔNG hardcode. */
export async function WpHeader({ menuNodes }: { menuNodes: HeaderNavNode[] }) {
  const locale = await getLocale();
  const settings = (await listPublicSettings(locale)).data ?? [];
  const address = pickSetting(settings, ["contact_address"]);
  const phones = [
    pickSetting(settings, ["hotline"]),
    pickSetting(settings, ["hotline_2"]),
    pickSetting(settings, ["hotline_3"]),
  ].filter(Boolean);
  const shopDescription =
    pickSetting(settings, ["footer_description"]) ||
    "Shop Bigbike.vn chuyên cung cấp đồ bảo hộ moto, xe máy, phượt, mũ bảo hộ Full Face, Mũ lật cằm, mũ 3/4, mũ cào cào, áo giáp quần bảo hộ, găng tay, balo, túi đeo moto, xe máy và các phụ kiện thời trang....";

  return (
    <>
      <header className="headroom">
        <div className="container">
          <div className="row">
            <div className="col-md-2">
              <div className="logo">
                <Link href="/">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`${T}/images/logo.png`} alt="logo bigbike" className="hide-mobile" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`${T}/images/logo-1.png`} alt="logo bigbike" className="hide-desktop" />
                </Link>
              </div>
            </div>
            <div className="col-md-10 text-right right-header">
              <div className="navigation d-inline-block js-navigation" id="nav-main">
                <div className="mobile-item">
                  <div className="user-control">
                    <div className="user-control--item user">
                      <WpHeaderUser variant="mobile" />
                    </div>
                  </div>
                </div>

                <WpMenu nodes={menuNodes} top />

                <div className="mobile-item">
                  <div className="information-slide">
                    <div className="content">
                      <WpContactMe address={address} phones={phones} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="user-control d-inline-block">
                <WpLangSwitch />
                <WpSearchIcon />
                <div className="user-control--item cart">
                  <Link href={toCartPath()} aria-label="Giỏ hàng">
                    <ShoppingCart size={22} strokeWidth={1.75} aria-hidden /> <WpCartCount />
                  </Link>
                </div>
                <div className="user-control--item user desktop-user">
                  <WpHeaderUser variant="desktop" />
                </div>
                <div className="user-control--item hammer-menu-mb hammer-menu">
                  <div className="lines">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
                <div className="user-control--item hammer-menu-desktop hammer-menu">
                  <div className="lines">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="information-slide-bigbike">
        <div className="overlay" />
        <div className="content">
          <div className="close">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
              focusable="false"
              data-prefix="far"
              data-icon="times"
              style={{ width: "16px" }}
              role="img"
              viewBox="0 0 320 512"
            >
              <path
                fill="currentColor"
                d="M207.6 256l107.72-107.72c6.23-6.23 6.23-16.34 0-22.58l-25.03-25.03c-6.23-6.23-16.34-6.23-22.58 0L160 208.4 52.28 100.68c-6.23-6.23-16.34-6.23-22.58 0L4.68 125.7c-6.23 6.23-6.23 16.34 0 22.58L112.4 256 4.68 363.72c-6.23 6.23-6.23 16.34 0 22.58l25.03 25.03c6.23 6.23 16.34 6.23 22.58 0L160 303.6l107.72 107.72c6.23 6.23 16.34 6.23 22.58 0l25.03-25.03c6.23-6.23 6.23-16.34 0-22.58L207.6 256z"
              />
            </svg>
          </div>
          <div className="logo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${T}/images/logo-1.png`} alt="logo bigbike" />
          </div>
          <div className="desc">
            <p>{shopDescription}</p>
          </div>
          <WpContactMe address={address} phones={phones} />
        </div>
      </div>
    </>
  );
}
