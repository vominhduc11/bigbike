import { Tr } from "@/components/i18n/Tr";
import { telHref } from "@/lib/utils/format";
import { WpFooterMenuLinks } from "./WpFooterMenuLinks";
import { WpLocalizedSetting } from "./WpLocalizedSetting";
import { listPublicSettings } from "@/lib/api/public-api";
import { pickSetting } from "@/lib/utils/settings";

const T = "/wp-content/themes/bigbike";

/**
 * Nội dung liên hệ/thương hiệu/menu chân trang — HARDCODE theo yêu cầu chủ shop
 * (2026-07-03), không còn đọc từ Cài đặt (site_settings) hay Menu trong trang
 * Quản trị. Muốn đổi SĐT/email/địa chỉ/mạng xã hội/slogan/ĐKKD/link chân
 * trang phải sửa trực tiếp các hằng số dưới đây, không sửa được từ Quản trị nữa.
 *
 * Ngoại lệ duy nhất là Mô tả ngắn (footer_description) trong footer được kết nối lại
 * với Cài đặt > Thông tin shop từ ngày 2026-07-04 theo yêu cầu của chủ shop.
 *
 * hotline/email/địa chỉ/mạng xã hội vẫn là các key site_settings dùng CHUNG cho
 * header, trang chủ, trang sản phẩm, Liên hệ, Giới thiệu, khung chat nổi... —
 * đổi ở Cài đặt sẽ cập nhật các nơi đó nhưng KHÔNG còn cập nhật footer.
 *
 * vi/en: `i18n/request.ts` cố định locale server là "vi" (route tĩnh ISR, không đọc
 * cookie) nên component server này luôn fetch settings ở CẢ 2 ngôn ngữ (vi + en) rồi
 * giao việc chọn hiển thị cho client component `WpLocalizedSetting`/`WpFooterMenuLinks`
 * (đọc `useLocale()` phía client, đổi ngay khi bấm nút chuyển vi/en, không cần tải
 * lại trang).
 */
const FOOTER_HOTLINES = ["0906 902 404", "0764 640 679 - Mrs. Thư / Zalo"];
const FOOTER_EMAIL = "bigbikevnshop@gmail.com";
const FOOTER_BCT_URL = "http://online.gov.vn/Home/WebDetails/27044";
const FOOTER_SOCIAL_LINKS = {
  facebook: "https://www.facebook.com/bigbikegear",
  youtube: "https://www.youtube.com/@bigbike-shop",
  tiktok: "https://www.tiktok.com/@bigbike.vn",
  shopee: "https://shopee.vn/shopbaohobigbike",
};

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

/** Rút nhãn hiển thị gọn từ URL mạng xã hội (prefix/handle), fallback về tên mạng. */
function socialLabel(url: string, prefix: string, fallback: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/^\/+|\/+$/g, "");
    return path ? `${prefix}/${path}` : u.host.replace(/^www\./, "");
  } catch {
    return fallback;
  }
}

/** Đường dẫn logo thương hiệu (simple-icons) cho các mạng xã hội mà font icon
 * icomoon của theme KHÔNG có glyph (youtube/tiktok/shopee). */
const BRAND_ICON_PATH = {
  youtube:
    "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z",
  tiktok:
    "M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z",
  shopee:
    "M15.9414 17.9633c.229-1.879-.981-3.077-4.1758-4.0969-1.548-.528-2.277-1.22-2.26-2.1719.065-1.056 1.048-1.825 2.352-1.85a5.2898 5.2898 0 0 1 2.8838.89c.116.072.197.06.263-.039.09-.145.315-.494.39-.62.051-.081.061-.187-.068-.281-.185-.1369-.704-.4149-.983-.5319a6.4697 6.4697 0 0 0-2.5118-.514c-1.909.008-3.4129 1.215-3.5389 2.826-.082 1.1629.494 2.1078 1.73 2.8278.262.152 1.6799.716 2.2438.892 1.774.552 2.695 1.5419 2.478 2.6969-.197 1.047-1.299 1.7239-2.818 1.7439-1.2039-.046-2.2878-.537-3.1278-1.19l-.141-.11c-.104-.08-.218-.075-.287.03-.05.077-.376.547-.458.67-.077.108-.035.168.045.234.35.293.817.613 1.134.775a6.7097 6.7097 0 0 0 2.8289.727 4.9048 4.9048 0 0 0 2.0759-.354c1.095-.465 1.8029-1.394 1.9449-2.554zM11.9986 1.4009c-2.068 0-3.7539 1.95-3.8329 4.3899h7.6657c-.08-2.44-1.765-4.3899-3.8328-4.3899zm7.8516 22.5981-.08.001-15.7843-.002c-1.074-.04-1.863-.91-1.971-1.991l-.01-.195L1.298 6.2858a.459.459 0 0 1 .45-.494h4.9748C6.8448 2.568 9.1607 0 11.9996 0c2.8388 0 5.1537 2.5689 5.2757 5.7898h4.9678a.459.459 0 0 1 .458.483l-.773 15.5883-.007.131c-.094 1.094-.979 1.9769-2.0709 2.0059z",
} as const;

/** Icon mạng xã hội bằng SVG (logo thương hiệu) — đặt trong <i> để dùng lại
 * định vị/màu sẵn có của `.social-list a i`. */
function SocialSvgIcon({ name, label }: { name: keyof typeof BRAND_ICON_PATH; label: string }) {
  return (
    <i aria-hidden="true">
      <svg
        viewBox="0 0 24 24"
        role="img"
        aria-label={label}
        focusable="false"
        style={{ width: "1em", height: "1em", fill: "currentColor", display: "block" }}
      >
        <path d={BRAND_ICON_PATH[name]} />
      </svg>
    </i>
  );
}

const titleStyle: React.CSSProperties = {
  color: "var(--bb-action-primary)",
  fontWeight: 500,
  fontSize: "1.143rem",
  textTransform: "uppercase",
  margin: "0 0 2.286rem",
};

/** Footer WordPress bigbike.vn — port 1:1 từ footer.php. */
export async function WpFooter() {
  const [settingsVi, settingsEn] = await Promise.all([
    listPublicSettings("vi"),
    listPublicSettings("en"),
  ]);
  const settingDescription = pickSetting(settingsVi.data ?? [], ["footer_description"]);
  const settingDescriptionEn = pickSetting(settingsEn.data ?? [], ["footer_description"]);

  return (
    <footer data-bb-focus="general_brand">
      <div className="top">
        <div className="container">
          <div className="row">
            <div className="col-md-7">
              <div className="newletters">
                <form action="">
                  <h2 className="slogan-bigbike"><Tr ns="Footer" k="taglineLong" /></h2>
                </form>
                <div className="contact-infor">
                  <div className="contact-infor--item">
                    {FOOTER_HOTLINES.map((phone) => (
                      <p key={phone}>
                        <i className="fal fa-phone-square-alt" /> <a href={telHref(phone)}>{phone}</a>
                      </p>
                    ))}
                    <p>
                      <a href={`mailto:${FOOTER_EMAIL}`}>
                        <i className="fal fa-envelope-open" /> {FOOTER_EMAIL}
                      </a>
                    </p>
                    <p>
                      <i className="fal fa-map-marker-alt" /> <Tr ns="Footer" k="address" />
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-md-5">
              <div className="information">
                <div className="information--item">
                  <p>
                    <WpLocalizedSetting
                      vi={settingDescription}
                      en={settingDescriptionEn}
                      fallback={<Tr ns="Footer" k="description" />}
                    />
                  </p>
                </div>
                <div className="row">
                  <div className="col-md-7">
                    <div className="information--item toggle--item">
                      <p style={titleStyle} className="toggle--item-title">
                        <Tr ns="Footer" k="infoHeading" /> <i className="fal fa-plus" />
                      </p>
                      <div className="toggle--item-body">
                        <WpFooterMenuLinks />
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
                            <li>
                              <a rel="nofollow" href={FOOTER_SOCIAL_LINKS.facebook}>
                                <i className="fab fa-facebook-f" /> {facebookLabel(FOOTER_SOCIAL_LINKS.facebook)}
                              </a>
                            </li>
                            <li>
                              <a rel="nofollow" href={FOOTER_SOCIAL_LINKS.youtube}>
                                <SocialSvgIcon name="youtube" label="YouTube" />{" "}
                                {socialLabel(FOOTER_SOCIAL_LINKS.youtube, "yt", "YouTube")}
                              </a>
                            </li>
                            <li>
                              <a rel="nofollow" href={FOOTER_SOCIAL_LINKS.tiktok}>
                                <SocialSvgIcon name="tiktok" label="TikTok" />{" "}
                                {socialLabel(FOOTER_SOCIAL_LINKS.tiktok, "tiktok", "TikTok")}
                              </a>
                            </li>
                            <li>
                              <a rel="nofollow" href={FOOTER_SOCIAL_LINKS.shopee}>
                                <SocialSvgIcon name="shopee" label="Shopee" />{" "}
                                {socialLabel(FOOTER_SOCIAL_LINKS.shopee, "shopee", "Shopee")}
                              </a>
                            </li>
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
                <a href={FOOTER_BCT_URL}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`${T}/images/license.png`} alt="logo-bigbike" />
                </a>
                <p><Tr ns="Footer" k="businessRegistration" /></p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
