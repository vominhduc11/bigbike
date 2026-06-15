import Link from "next/link";
import { getLocale } from "next-intl/server";
import { Tr } from "@/components/i18n/Tr";
import type { HeaderNavNode } from "@/components/layout/HeaderNavItem";
import { listPublicSettings } from "@/lib/api/public-api";
import { normalizeMenuUrl } from "@/lib/utils/nav";
import { telHref } from "@/lib/utils/format";
import { pickSetting } from "@/lib/utils/settings";

const T = "/wp-content/themes/bigbike";

const BCT_FALLBACK_URL = "http://online.gov.vn/Home/WebDetails/27044";

/** Rút nhãn hiển thị gọn từ URL Facebook (vd https://facebook.com/bigbike.vn → fb/bigbike.vn). */
function facebookLabel(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/^\/+|\/+$/g, "");
    return path ? `fb/${path}` : u.host.replace(/^www\./, "");
  } catch {
    return "fb/bigbike.vn";
  }
}

const titleStyle: React.CSSProperties = {
  color: "#ff0c09",
  fontWeight: 500,
  fontSize: "1.143rem",
  textTransform: "uppercase",
  margin: "0 0 2.286rem",
};

function FooterMenu({ nodes }: { nodes: HeaderNavNode[] }) {
  return (
    <ul className="menu">
      {nodes.map((node) => {
        const href = normalizeMenuUrl(node.url) || "/";
        return (
          <li key={node.id} className="menu-item">
            <Link href={href} target={node.openInNewTab ? "_blank" : undefined}>
              {node.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Footer WordPress bigbike.vn — port 1:1 từ footer.php; menu + thông tin liên
 * hệ (SĐT / email / facebook) lấy từ settings công khai, KHÔNG hardcode. */
export async function WpFooter({ footerNodes }: { footerNodes: HeaderNavNode[] }) {
  const locale = await getLocale();
  const settings = (await listPublicSettings(locale)).data ?? [];
  const phones = [
    pickSetting(settings, ["hotline"]),
    pickSetting(settings, ["hotline_2"]),
    pickSetting(settings, ["hotline_3"]),
  ].filter(Boolean);
  const email = pickSetting(settings, ["contact_email"]);
  const facebookUrl = pickSetting(settings, ["facebook_url"]);
  // Slogan / mô tả / link Bộ Công Thương / ĐKKD ưu tiên lấy từ settings (admin sửa được);
  // fallback về copy theme khi setting còn trống.
  const tagline = pickSetting(settings, ["footer_tagline"]);
  const shopDescription = pickSetting(settings, ["footer_description"]);
  const bctUrl = pickSetting(settings, ["bct_url"]) || BCT_FALLBACK_URL;
  const businessRegistration = pickSetting(settings, ["business_registration"]);

  return (
    <footer>
      <div className="top">
        <div className="container">
          <div className="row">
            <div className="col-md-7">
              <div className="newletters">
                <form action="">
                  <h2 className="slogan-bigbike">
                    {tagline ? (
                      tagline
                    ) : (
                      <>
                        <Tr ns="Footer" k="wpSloganLine1" /> <br />
                        <Tr ns="Footer" k="wpSloganLine2" />
                      </>
                    )}
                  </h2>
                </form>
                <div className="contact-infor">
                  <div className="contact-infor--item">
                    {phones.map((phone) => (
                      <p key={phone}>
                        <i className="fal fa-phone-square-alt" /> <a href={telHref(phone)}>{phone}</a>
                      </p>
                    ))}
                    {email ? (
                      <p>
                        <a href={`mailto:${email}`}>
                          <i className="fal fa-envelope-open" /> {email}
                        </a>
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
            <div className="col-md-5">
              <div className="information">
                <div className="information--item">
                  <p>
                    {shopDescription ? shopDescription : <Tr ns="Footer" k="wpShopDescription" />}
                  </p>
                </div>
                <div className="row">
                  <div className="col-md-7">
                    <div className="information--item toggle--item">
                      <p style={titleStyle} className="toggle--item-title">
                        <Tr ns="Footer" k="infoHeading" /> <i className="fal fa-plus" />
                      </p>
                      <div className="toggle--item-body">
                        <FooterMenu nodes={footerNodes} />
                      </div>
                    </div>
                  </div>
                  <div className="col-md-5">
                    <div className="information--item toggle--item">
                      <p style={titleStyle} className="toggle--item-title">
                        <Tr ns="Footer" k="socialHeading" /> <i className="fal fa-plus" />
                      </p>
                      <div className="toggle--item-body">
                        <div className="social-list">
                          <ul>
                            {facebookUrl ? (
                              <li>
                                <a rel="nofollow" href={facebookUrl}>
                                  <i className="fab fa-facebook-f" /> {facebookLabel(facebookUrl)}
                                </a>
                              </li>
                            ) : null}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="foot">
        <div className="container">
          <div className="scrollToTop">
            <i className="fal fa-chevron-up" />
          </div>
          <div className="row align-items-center">
            <div className="col-md-2">
              <div className="logo">
                <a href="#">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`${T}/images/logo-footer.png`} alt="logo-bigbike" />
                </a>
              </div>
            </div>
            <div className="col-md-4">
              <div className="copyright">
                <p>Copyright © {new Date().getFullYear()}. All Rights Reserved.</p>
              </div>
            </div>
            <div className="col-md-6">
              <div className="license">
                <a href={bctUrl}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`${T}/images/license.png`} alt="logo-bigbike" />
                </a>
                <p>
                  {businessRegistration ? businessRegistration : <Tr ns="Footer" k="businessReg" />}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
