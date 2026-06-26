import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { getLocale } from "next-intl/server";
import type { HeaderNavNode } from "@/components/layout/header-nav/shared";
import { listPublicSettings } from "@/lib/api/public-api";
import { Tr } from "@/components/i18n/Tr";
import { WpSearchIcon } from "./WpSearchIcon";
import { pickSetting } from "@/lib/utils/settings";
import { toCartPath } from "@/lib/utils/routes";
import { WpCartCount } from "./WpCartCount";
import { WpHeaderUser } from "./WpHeaderUser";
import { WpLangSwitch } from "./WpLangSwitch";
import { WpMenuClient } from "./WpMenuClient";

const T = "/wp-content/themes/bigbike";

/**
 * Khối "Thông tin liên hệ" — xuất hiện ở cả mobile-item lẫn drawer
 * information-slide-bigbike (markup .contact-me giống hệt nhau trong header.php).
 * Giờ làm + nhãn cửa hàng là copy cố định của theme; địa chỉ + SĐT lấy từ settings.
 */
function WpContactMe({
  address,
  phones,
  hours,
}: {
  address: string;
  phones: string[];
  hours: { weekday: string; weekend: string; holiday: string };
}) {
  return (
    <div className="contact-me">
      <p className="title-contact-me"><Tr ns="Header" k="shopInfoContactHeading" /></p>
      <ul>
        <li>
          <div className="row">
            <div className="col icon">
              <i className="fal fa-clock" />
            </div>
            <div className="col">
              <p>{hours.weekday || <Tr ns="Header" k="wpHoursWeekday" />}</p>
              <p>{hours.weekend || <Tr ns="Header" k="wpHoursWeekend" />}</p>
              <p>{hours.holiday || <Tr ns="Header" k="wpHoursHoliday" />}</p>
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
                <p><Tr ns="Header" k="wpContactStore" /></p>
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



function filterMenuNodes(nodes: HeaderNavNode[]): HeaderNavNode[] {
  return nodes
    .filter((node) => {
      const url = node.url || "";
      return !url.includes("huong-dan-mua-hang") && !url.includes("cac-dieu-kien-va-dieu-khoan");
    })
    .map((node) => ({
      ...node,
      children: filterMenuNodes(node.children),
    }));
}

/** Header WordPress bigbike.vn — port 1:1 từ header.php; menu + thông tin liên hệ
 * (địa chỉ / SĐT) lấy từ settings công khai, KHÔNG hardcode. */
export async function WpHeader({ menuNodes }: { menuNodes: HeaderNavNode[] }) {
  const filteredMenuNodes = filterMenuNodes(menuNodes);
  const locale = await getLocale();
  const settings = (await listPublicSettings(locale)).data ?? [];
  const address = pickSetting(settings, ["contact_address"]);
  const phones = [
    pickSetting(settings, ["hotline"]),
    pickSetting(settings, ["hotline_2"]),
    pickSetting(settings, ["hotline_3"]),
  ].filter(Boolean);
  const shopDescription = pickSetting(settings, ["footer_description"]);
  // Giờ mở cửa lấy từ settings (admin sửa được), fallback copy theme khi trống.
  const hours = {
    weekday: pickSetting(settings, ["opening_hours_weekday"]),
    weekend: pickSetting(settings, ["opening_hours_weekend"]),
    holiday: pickSetting(settings, ["opening_hours_holiday"]),
  };

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

                <WpMenuClient initialNodes={filteredMenuNodes} location="primary" top />

                <div className="mobile-item">
                  <div className="information-slide">
                    <div className="content">
                      <WpContactMe address={address} phones={phones} hours={hours} />
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
            <p>{shopDescription || <Tr ns="Header" k="shopInfoDefaultDescription" />}</p>
          </div>
          <WpContactMe address={address} phones={phones} hours={hours} />
        </div>
      </div>
    </>
  );
}
