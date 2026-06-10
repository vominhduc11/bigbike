import Link from "next/link";
import { getLocale } from "next-intl/server";
import type { HeaderNavNode } from "@/components/layout/HeaderNavItem";
import { listPublicSettings } from "@/lib/api/public-api";
import { normalizeMenuUrl } from "@/lib/utils/nav";
import { telHref } from "@/lib/utils/format";
import { pickSetting } from "@/lib/utils/settings";

const T = "/wp-content/themes/bigbike";

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

  return (
    <footer>
      <div className="top">
        <div className="container">
          <div className="row">
            <div className="col-md-7">
              <div className="newletters">
                <form action="">
                  <h2 className="slogan-bigbike">
                    Bigbike mong được lắng nghe <br />
                    và thấu hiểu bạn hơn
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
                    Shop Bigbike.vn chuyên cung cấp đồ bảo hộ moto, xe máy, phượt, mũ bảo hộ Full Face,
                    Mũ lật cằm, mũ 3/4, mũ cào cào, áo giáp quần bảo hộ, găng tay, balo, túi đeo moto, xe
                    máy và các phụ kiện thời trang....
                  </p>
                </div>
                <div className="row">
                  <div className="col-md-7">
                    <div className="information--item toggle--item">
                      <p style={titleStyle} className="toggle--item-title">
                        Thông tin <i className="fal fa-plus" />
                      </p>
                      <div className="toggle--item-body">
                        <FooterMenu nodes={footerNodes} />
                      </div>
                    </div>
                  </div>
                  <div className="col-md-5">
                    <div className="information--item toggle--item">
                      <p style={titleStyle} className="toggle--item-title">
                        mạng xã hội <i className="fal fa-plus" />
                      </p>
                      <div className="toggle--item-body">
                        <div className="social-list">
                          <ul>
                            {facebookUrl ? (
                              <li>
                                <a rel="nofollow" href={facebookUrl}>
                                  <i className="fab fa-facebook-f" /> fb/bigbike.vn
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
                <p>Copyright © 2020. All Rights Reserved.</p>
              </div>
            </div>
            <div className="col-md-6">
              <div className="license">
                <a href="http://online.gov.vn/Home/WebDetails/27044">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`${T}/images/license.png`} alt="logo-bigbike" />
                </a>
                <p>
                  Giấy chứng nhận đăng ký kinh doanh số: 41K8017383 | Ngày cấp 8 tháng 3 năm 2016 | Nơi
                  cấp: Ủy Ban Nhân Dân Quận 11
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
