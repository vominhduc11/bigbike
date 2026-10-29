import { ArrowUpRight, Mail, MapPin, Phone } from "lucide-react";
import Link from "@/i18n/StorefrontLink";
import { getTranslations } from "next-intl/server";

import { LocalizedSetting } from "@/components/i18n/LocalizedSetting";
import { Tr } from "@/components/i18n/Tr";
import { Container } from "@/components/layout/Container";
import {
  FooterMenuLinks,
  FooterSections,
  FooterSupportLinks,
} from "@/components/layout/FooterMenuLinks";
import { SOCIAL_LINK_LABELS } from "@/lib/content/social-links";
import { BUSINESS_IDENTITY, getBusinessLicense } from "@/lib/content/business-identity";
import { Button } from "@/components/ui/button";
import { listPublicSettings } from "@/lib/api/public-api";
import { cn } from "@/lib/utils";
import { telHref } from "@/lib/utils/format";
import { toHomePath, translatePath } from "@/lib/utils/routes";
import type { Locale } from "@/i18n/locale";
import { pickSetting } from "@/lib/utils/settings";
import { MediaImage } from "@/components/ui/MediaImage";

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
 * giao việc chọn hiển thị cho client component `LocalizedSetting`/`FooterMenuLinks`
 * (đọc `useLocale()` phía client, đổi ngay khi bấm nút chuyển vi/en, không cần tải
 * lại trang).
 */
const FOOTER_HOTLINES = ["0906 902 404", "0764 640 679"];
const FOOTER_EMAIL = "bigbikevnshop@gmail.com";
const FOOTER_SOCIAL_LINKS = {
  facebook: "https://www.facebook.com/bigbikegear",
  youtube: "https://www.youtube.com/@bigbike-shop",
  tiktok: "https://www.tiktok.com/@bigbike.vn",
  shopee: "https://shopee.vn/shopbaohobigbike",
} as const;

const SOCIAL_CHANNELS = ["facebook", "youtube", "tiktok", "shopee"] as const;
type SocialChannel = (typeof SOCIAL_CHANNELS)[number];

/** Logo thương hiệu (simple-icons) cho mạng xã hội — lucide-react không có glyph
 * brand-chính-xác cho facebook/youtube/tiktok/shopee. */
const BRAND_ICON_PATH = {
  facebook:
    "M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.226.366-.317.826-.317 1.379v1.671h3.919l-.386 1.628-.66 2.043h-2.873v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z",
  youtube:
    "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z",
  tiktok:
    "M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z",
  shopee:
    "M15.9414 17.9633c.229-1.879-.981-3.077-4.1758-4.0969-1.548-.528-2.277-1.22-2.26-2.1719.065-1.056 1.048-1.825 2.352-1.85a5.2898 5.2898 0 0 1 2.8838.89c.116.072.197.06.263-.039.09-.145.315-.494.39-.62.051-.081.061-.187-.068-.281-.185-.1369-.704-.4149-.983-.5319a6.4697 6.4697 0 0 0-2.5118-.514c-1.909.008-3.4129 1.215-3.5389 2.826-.082 1.1629.494 2.1078 1.73 2.8278.262.152 1.6799.716 2.2438.892 1.774.552 2.695 1.5419 2.478 2.6969-.197 1.047-1.299 1.7239-2.818 1.7439-1.2039-.046-2.2878-.537-3.1278-1.19l-.141-.11c-.104-.08-.218-.075-.287.03-.05.077-.376.547-.458.67-.077.108-.035.168.045.234.35.293.817.613 1.134.775a6.7097 6.7097 0 0 0 2.8289.727 4.9048 4.9048 0 0 0 2.0759-.354c1.095-.465 1.8029-1.394 1.9449-2.554zM11.9986 1.4009c-2.068 0-3.7539 1.95-3.8329 4.3899h7.6657c-.08-2.44-1.765-4.3899-3.8328-4.3899zm7.8516 22.5981-.08.001-15.7843-.002c-1.074-.04-1.863-.91-1.971-1.991l-.01-.195L1.298 6.2858a.459.459 0 0 1 .45-.494h4.9748C6.8448 2.568 9.1607 0 11.9996 0c2.8388 0 5.1537 2.5689 5.2757 5.7898h4.9678a.459.459 0 0 1 .458.483l-.773 15.5883-.007.131c-.094 1.094-.979 1.9769-2.0709 2.0059z",
} as const;

function SocialSvgIcon({ name }: { name: SocialChannel }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      aria-hidden="true"
      focusable="false"
      className="shrink-0 fill-current text-brand-on-dark"
    >
      <path d={BRAND_ICON_PATH[name]} />
    </svg>
  );
}

/** Footer bigbike.vn dùng Tailwind + Radix. */
export async function Footer({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "Footer" });
  const [policyVi, policyEn] = await Promise.all([
    getTranslations({ locale: "vi", namespace: "PolicyContact" }),
    getTranslations({ locale: "en", namespace: "PolicyContact" }),
  ]);
  const settingsResult = await listPublicSettings(locale);
  const settingDescription = pickSetting(settingsResult.data ?? [], ["footer_description"]);
  const representativeValues = { name: BUSINESS_IDENTITY.representative };
  const businessDetails = (
    <div
      data-footer-business-details
      className="grid min-w-0 grid-cols-1 gap-x-10 gap-y-3 text-a4-content leading-body text-white [overflow-wrap:anywhere] md:grid-cols-2"
    >
      <p className="m-0 font-bold text-brand-on-dark md:col-span-2">{BUSINESS_IDENTITY.name}</p>
      <p className="m-0">
        <Tr ns="PolicyContact" k="address" />: <Tr ns="Footer" k="address" />
      </p>
      <p className="m-0">
        <LocalizedSetting
          vi={getBusinessLicense("vi")}
          en={getBusinessLicense("en")}
          fallback={getBusinessLicense(locale)}
        />
      </p>
      <p className="m-0">
        <Tr ns="PolicyContact" k="hotline" />: {FOOTER_HOTLINES.join(" - ")}{" "}
        <Tr ns="PolicyContact" k="email" />:{" "}
        <a
          href={`mailto:${FOOTER_EMAIL}`}
          className="text-white! no-underline! focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
        >
          {FOOTER_EMAIL}
        </a>
      </p>
      <p className="m-0">
        <LocalizedSetting
          vi={policyVi("representative", representativeValues)}
          en={policyEn("representative", representativeValues)}
          fallback={(locale === "en" ? policyEn : policyVi)("representative", representativeValues)}
        />
      </p>
      <a
        href="https://online.gov.vn/nen-tang/fdd92044-4eaa-4886-ac23-b8a8f324ff2d"
        target="_blank"
        rel="noopener noreferrer"
        className="relative mt-2 block aspect-[115/43] w-44 max-w-full no-underline! focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white md:col-span-2"
      >
        <MediaImage
          image={{ url: "/brand/commerce-certification.png", width: 230, height: 86 }}
          altFallback=""
          fill
          sizes="176px"
          className="object-contain"
        />
        <span className="sr-only">
          <Tr ns="Footer" k="commerceNotification" />
        </span>
      </a>
    </div>
  );

  return (
    <footer
      id="site-footer"
      data-bb-full-bleed
      data-bb-focus="general_brand"
      className={cn(
        "relative z-0 w-full bg-black font-body text-white",
        // Reserve space for the fixed mobile nav even inside FooterMobileGate.
        "max-md:[body:has(.bb-bottom-nav)_&]:pb-[calc(var(--bb-mobile-nav-height)+env(safe-area-inset-bottom))]",
      )}
    >
      <div data-footer-top className="bg-footer-top py-8 lg:py-12">
        <Container>
          <FooterSections
            contact={
              <div data-footer-contacts className="min-w-0">
                <h2
                  data-footer-intro
                  className="mb-4 font-cta text-a2-page font-semibold uppercase leading-snug"
                >
                  <Tr ns="Footer" k="contactTitle" />
                </h2>
                <div className="mb-3 grid grid-cols-[repeat(auto-fit,minmax(min(100%,10rem),1fr))] gap-3">
                  {FOOTER_HOTLINES.map((phone) => (
                    <Button
                      key={phone}
                      asChild
                      variant="outline"
                      className="min-h-12 justify-start gap-2 border-white/30 px-3 py-3 text-a4-content text-white! no-underline! hover:border-brand-on-dark hover:bg-white/5 hover:not-disabled:scale-100 focus-visible:outline-white"
                    >
                      <a href={telHref(phone)} data-analytics-location="footer">
                        <Phone className="h-4 w-4 shrink-0 text-brand-on-dark" aria-hidden />
                        <span className="whitespace-nowrap">{phone}</span>
                      </a>
                    </Button>
                  ))}
                </div>
                <a
                  href={`mailto:${FOOTER_EMAIL}`}
                  className="mb-3 flex min-h-11 min-w-0 items-center gap-3 text-a4-content text-white! no-underline! focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                >
                  <Mail className="h-5 w-5 shrink-0 text-brand-on-dark" aria-hidden />
                  <span data-footer-email className="min-w-0 [overflow-wrap:anywhere]">
                    {FOOTER_EMAIL}
                  </span>
                </a>
                <Link
                  href={translatePath("/lien-he/", locale)}
                  className="flex min-h-11 min-w-0 items-start gap-3 text-a4-content leading-body text-white! no-underline! focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                >
                  <MapPin className="mt-1 h-5 w-5 shrink-0 text-brand-on-dark" aria-hidden />
                  <span className="min-w-0 [overflow-wrap:anywhere]">
                    <Tr ns="Footer" k="address" />
                    <span className="mt-2 flex min-h-11 items-center gap-2 text-white">
                      <Tr ns="Footer" k="visitStore" />
                      <ArrowUpRight className="h-4 w-4 shrink-0 text-brand-on-dark" aria-hidden />
                    </span>
                  </span>
                </Link>
              </div>
            }
            sections={[
              {
                value: "menu",
                title: <Tr ns="Footer" k="infoHeading" />,
                content: <FooterMenuLinks />,
              },
              {
                value: "support",
                title: <Tr ns="Footer" k="warrantyGuidesHeading" />,
                content: <FooterSupportLinks />,
              },
              {
                value: "social",
                title: <Tr ns="Footer" k="socialHeading" />,
                content: (
                  <ul className="m-0 grid list-none grid-cols-2 gap-x-4 gap-y-2 p-0 lg:grid-cols-1">
                    {SOCIAL_CHANNELS.map((key) => {
                      const profile = SOCIAL_LINK_LABELS[key];
                      return (
                        <li key={key} className="min-w-0">
                          <a
                            rel="nofollow noopener noreferrer"
                            target="_blank"
                            href={FOOTER_SOCIAL_LINKS[key]}
                            aria-label={`${profile.platform} - ${profile.displayName}`}
                            className="flex min-h-14 min-w-0 items-center gap-2 text-white! no-underline! focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                          >
                            <SocialSvgIcon name={key} />
                            <span className="min-w-0 [overflow-wrap:anywhere]">
                              <span className="block">{profile.platform}</span>
                              <span className="block text-a5-meta text-[var(--bb-text-inverse-secondary)]">
                                {profile.displayName}
                              </span>
                            </span>
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                ),
              },
              {
                value: "about",
                title: <Tr ns="Footer" k="aboutHeading" />,
                content: (
                  <p
                    data-footer-description
                    className="m-0 text-a4-content leading-body text-[var(--bb-text-inverse-secondary)]"
                  >
                    <LocalizedSetting
                      vi={settingDescription}
                      en={settingDescription}
                      fallback={<Tr ns="Footer" k="description" />}
                    />
                  </p>
                ),
              },
            ]}
          />
        </Container>
      </div>
      <div className="bg-black py-8">
        <Container data-footer-registration>{businessDetails}</Container>
        <Container className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 border-t border-white/15 pt-6">
            <Link
              href={toHomePath(locale)}
              className="flex min-h-11 shrink-0 items-center no-underline! focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
            >
              <MediaImage
                image={{ url: "/brand/footer-wordmark.png", width: 150, height: 55 }}
                altFallback="BigBike"
                sizes="120px"
                className="h-auto w-30"
              />
            </Link>
            <p className="m-0 text-a5-meta leading-body text-[var(--bb-text-inverse-secondary)]">
              {t("copyright", { year: new Date().getFullYear() })}
            </p>
          </div>
        </Container>
      </div>
    </footer>
  );
}
