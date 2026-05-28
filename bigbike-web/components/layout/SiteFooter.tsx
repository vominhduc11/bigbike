import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Mail, PhoneCall } from "lucide-react";
import { getPublicMenu, listPublicSettings } from "@/lib/api/public-api";
import { flattenPublicMenuTree, buildPublicMenuTree } from "@/lib/utils/public-menu";
import { normalizeMenuUrl } from "@/lib/utils/nav";
import { pickSetting } from "@/lib/utils/settings";
import { BctBadge } from "./BctBadge";
import { FooterCollapsible } from "./FooterCollapsible";
import { ScrollToTopButton } from "./ScrollToTopButton";

type FooterContact = {
  id: string;
  label: string;
  hrefValue: string;
  icon: "phone" | "email";
};

type FooterLink = {
  id: string;
  label: string;
  url: string;
  external: boolean;
};

type SocialLink = {
  id: string;
  label: string;
  url: string;
};

const FOOTER_MENU_LOCATION = "footer";

function telHref(value: string): string {
  return value.replace(/[^\d+]/g, "");
}

function splitHeading(value: string): string[] {
  return value
    .split(/\n|<br\s*\/?>/i)
    .map((line) => line.trim())
    .filter(Boolean);
}

function ContactIcon({ icon }: { icon: FooterContact["icon"] }) {
  return (
    <span className="mt-0.5 shrink-0 text-brand-inverse md:mt-1" aria-hidden="true">
      {icon === "phone" ? (
        <PhoneCall size={22} strokeWidth={2} />
      ) : (
        <Mail size={22} strokeWidth={2} />
      )}
    </span>
  );
}

// Monochrome brand glyphs, rendered at a fixed 18px inside a reserved 20px slot
// so every social row aligns regardless of which network it is. Icons inherit
// currentColor → white by default, brand-inverse red on hover/focus (set on the link).
function SocialIcon({ id }: { id: string }) {
  switch (id) {
    case "facebook":
      return (
        <svg width="18" height="18" viewBox="0 0 320 512" fill="currentColor" aria-hidden="true">
          <path d="M279.14 288l14.22-92.66h-88.91v-60.13c0-25.35 12.42-50.06 52.24-50.06h40.42V6.26S260.43 0 225.36 0c-73.22 0-121.08 44.38-121.08 124.72v70.62H22.89V288h81.39v224h100.17V288z" />
        </svg>
      );
    case "instagram":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.43.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.43.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.7 3.7 0 0 1-1.38-.9 3.7 3.7 0 0 1-.9-1.38c-.16-.43-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.43-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16M12 0C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63c-.79.3-1.46.72-2.13 1.38C1.35 2.68.93 3.35.63 4.14.33 4.9.13 5.78.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91.3.79.72 1.46 1.38 2.13.67.66 1.34 1.08 2.13 1.38.76.3 1.64.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56a5.7 5.7 0 0 0 2.13-1.38 5.7 5.7 0 0 0 1.38-2.13c.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91a5.7 5.7 0 0 0-1.38-2.13A5.7 5.7 0 0 0 19.86.63c-.76-.3-1.64-.5-2.91-.56C15.67.01 15.26 0 12 0M12 5.84A6.16 6.16 0 1 0 18.16 12 6.16 6.16 0 0 0 12 5.84M12 16A4 4 0 1 1 16 12 4 4 0 0 1 12 16M18.41 4.15a1.44 1.44 0 1 0 1.44 1.44 1.44 1.44 0 0 0-1.44-1.44" />
        </svg>
      );
    case "youtube":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.5A3.02 3.02 0 0 0 .5 6.19C0 8.07 0 12 0 12s0 3.93.5 5.81a3.02 3.02 0 0 0 2.12 2.14c1.88.5 9.38.5 9.38.5s7.5 0 9.38-.5a3.02 3.02 0 0 0 2.12-2.14C24 15.93 24 12 24 12s0-3.93-.5-5.81M9.55 15.57V8.43L15.82 12Z" />
        </svg>
      );
    case "tiktok":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07Z" />
        </svg>
      );
    case "messenger":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 0C5.24 0 0 4.95 0 11.64a11.39 11.39 0 0 0 3.77 8.55.97.97 0 0 1 .32.68l.07 2.14a.96.96 0 0 0 1.35.85l2.39-1.05a.96.96 0 0 1 .64-.05c1.09.3 2.26.46 3.47.46 6.76 0 12-4.95 12-11.64S18.76 0 12 0m7.2 8.94l-3.52 5.6c-.56.88-1.76 1.11-2.6.48l-2.8-2.1a.72.72 0 0 0-.87 0l-3.79 2.87c-.5.39-1.17-.22-.82-.75l3.52-5.6a1.81 1.81 0 0 1 2.6-.48l2.8 2.1c.27.2.61.2.87 0l3.79-2.87c.5-.38 1.17.22.82.75" />
        </svg>
      );
    case "zalo":
      return (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinejoin="round"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M4 3.6h16a2 2 0 0 1 2 2v8.4a2 2 0 0 1-2 2h-7.2L8 19.8V16H4a2 2 0 0 1-2-2V5.6a2 2 0 0 1 2-2Z" />
          <path d="M9 8.2h5.4l-5.4 6.2h5.4" />
        </svg>
      );
    default:
      // Unknown network — still fill the reserved slot with a neutral link glyph
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M3.9 12a4.1 4.1 0 0 1 4.1-4.1h3v1.9H8a2.2 2.2 0 0 0 0 4.4h3V16H8A4.1 4.1 0 0 1 3.9 12M9 12.95h6v-1.9H9zM16 7.9h-3v1.9h3a2.2 2.2 0 0 1 0 4.4h-3V16h3a4.1 4.1 0 0 0 0-8.2" />
        </svg>
      );
  }
}

function buildFooterLinks(
  items: Awaited<ReturnType<typeof getPublicMenu>>["data"] extends infer T
    ? T extends { items: infer I }
      ? I
      : never
    : never,
): FooterLink[] {
  if (!items || items.length === 0) {
    return [];
  }

  return flattenPublicMenuTree(buildPublicMenuTree(items))
    .filter((item) => item.url.trim().length > 0)
    .map((item) => {
      const rawUrl = item.url.trim();
      const external = /^https?:\/\//i.test(rawUrl);
      return {
        id: item.id,
        label: item.label.trim() || rawUrl,
        url: external ? rawUrl : normalizeMenuUrl(rawUrl),
        external,
      };
    });
}

function buildSocialLinks(settings: { settingKey: string; settingValue: string }[]): SocialLink[] {
  const keys: Array<[string, string]> = [
    ["facebook", "facebook_url"],
    ["zalo", "zalo_url"],
    ["instagram", "instagram_url"],
    ["youtube", "youtube_url"],
    ["tiktok", "tiktok_url"],
    ["messenger", "messenger_url"],
  ];

  return keys
    .map(([id, settingKey]) => ({
      id,
      label: id.charAt(0).toUpperCase() + id.slice(1),
      url: pickSetting(settings, [settingKey]),
    }))
    .filter((item) => item.url);
}

export async function SiteFooter() {
  const [settingsResult, menuResult, t] = await Promise.all([
    listPublicSettings(),
    getPublicMenu(FOOTER_MENU_LOCATION),
    getTranslations("Footer"),
  ]);

  const settings = settingsResult.data ?? [];
  const siteName = pickSetting(settings, ["site_name"]) || "BigBike";
  const footerTagline = pickSetting(settings, ["footer_tagline"]) || siteName;
  const footerDescription = pickSetting(settings, ["footer_description"]);
  const bctUrl = pickSetting(settings, ["bct_url"]);

  const contacts: FooterContact[] = [
    {
      id: "hotline",
      label: pickSetting(settings, ["hotline"]),
      hrefValue: pickSetting(settings, ["hotline"]),
      icon: "phone" as const,
    },
    {
      id: "hotline-2",
      label: pickSetting(settings, ["hotline_2"]),
      hrefValue: pickSetting(settings, ["hotline_2"]),
      icon: "phone" as const,
    },
    {
      id: "hotline-3",
      label: pickSetting(settings, ["hotline_3"]),
      hrefValue: pickSetting(settings, ["hotline_3"]),
      icon: "phone" as const,
    },
    {
      id: "email",
      label: pickSetting(settings, ["contact_email"]),
      hrefValue: pickSetting(settings, ["contact_email"]),
      icon: "email" as const,
    },
  ].filter((item) => item.label);

  const footerLinks = buildFooterLinks(menuResult.data?.items ?? []);
  const socialLinks = buildSocialLinks(settings);

  if (!menuResult.data) {
    console.warn(
      `[SiteFooter] Menu "${FOOTER_MENU_LOCATION}" could not be loaded.`,
      menuResult.error?.message ?? "unknown error",
    );
  }

  return (
    <footer className="bg-black text-white">
      <div className="bg-footer-top py-[60px] max-md:pb-0 max-md:pt-9">
        <div className="bb-container">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-12 md:gap-10">
            <div className="md:col-span-7">
              <h2 className="m-0 mb-7 font-cta text-[2.25rem] font-medium uppercase leading-[1.12] text-white md:mb-[2.857rem] md:text-[3.429rem] md:leading-[4.143rem] lg:max-w-[43rem]">
                {splitHeading(footerTagline).map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </h2>

              <div className="space-y-3 max-md:mb-[30px] md:space-y-[0.55rem]">
                {contacts.map((item) => {
                  const isEmail = item.icon === "email";
                  const href = isEmail
                    ? `mailto:${item.hrefValue}`
                    : `tel:${telHref(item.hrefValue)}`;

                  return (
                    <a
                      key={item.id}
                      href={href}
                      className={`flex min-w-0 items-start gap-3.5 font-cta font-medium text-white no-underline transition-colors hover:text-brand-inverse md:gap-5 md:text-[2.143rem] ${
                        isEmail
                          ? "text-[1.375rem] leading-[1.2]"
                          : "text-[1.625rem] leading-[1.14]"
                      }`}
                    >
                      <ContactIcon icon={item.icon} />
                      <span className="min-w-0 [overflow-wrap:anywhere]">{item.label}</span>
                    </a>
                  );
                })}
                {contacts.length === 0 ? (
                  <p className="m-0 text-base leading-[1.786rem] text-white/75">
                    {t("contactUpdating")}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="md:col-span-5">
              {footerDescription ? (
                <p className="m-0 mb-7 text-[15px] leading-[1.65] text-white md:mb-[2.286rem] md:max-w-[40rem] md:text-base md:leading-[1.786rem]">
                  {footerDescription}
                </p>
              ) : null}

              <div className="grid grid-cols-1 gap-0 xl:grid-cols-12">
                <div className="xl:col-span-7">
                  <FooterCollapsible title={t("infoHeading")}>
                    {footerLinks.length > 0 ? (
                      <ul className="m-0 list-none p-0">
                        {footerLinks.map((item) => (
                          <li key={item.id} className="mb-[0.429rem] last:mb-0">
                            {item.external ? (
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-base leading-[1.45] text-white no-underline transition-colors hover:text-brand-inverse"
                              >
                                {item.label}
                              </a>
                            ) : (
                              <Link
                                href={item.url}
                                className="text-base leading-[1.45] text-white no-underline transition-colors hover:text-brand-inverse"
                              >
                                {item.label}
                              </Link>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="m-0 text-base leading-[1.45] text-white/75">
                        {t("linkFallback")}
                      </p>
                    )}
                  </FooterCollapsible>
                </div>

                <div className="xl:col-span-5">
                  <FooterCollapsible title={t("socialHeading")}>
                    {socialLinks.length > 0 ? (
                      <ul className="m-0 flex list-none flex-col gap-[1.571rem] p-0">
                        {socialLinks.map((item) => (
                          <li key={item.id}>
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-3 text-base leading-none text-white no-underline transition-colors hover:text-brand-inverse focus-visible:text-brand-inverse focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                            >
                              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center">
                                <SocialIcon id={item.id} />
                              </span>
                              <span>{item.label}</span>
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="m-0 text-base leading-[1.45] text-white/75">
                        {t("socialUpdating")}
                      </p>
                    )}
                  </FooterCollapsible>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-black py-[30px] max-md:pb-5 max-md:pt-6">
        <div className="bb-container relative">
          <ScrollToTopButton />
          <div className="grid grid-cols-1 items-center gap-5 md:grid-cols-12 md:gap-0">
            <div className="md:col-span-2 max-md:order-1">
              <Image
                src="/wp/logo-footer.png"
                alt={siteName}
                width={200}
                height={66}
                className="block h-auto w-[132px] max-md:w-[118px] 3xl:w-[160px] 4xl:w-[180px]"
              />
            </div>

            <div className="md:col-span-4 max-md:order-2">
              <p className="m-0 max-w-[22rem] text-sm leading-[1.45] text-white md:text-base">
                {t("copyright", { year: new Date().getFullYear() })}
              </p>
            </div>

            <div className="md:col-span-6 max-md:order-3 max-md:pr-14">
              {bctUrl ? (
                <div className="md:relative md:pl-[138px]">
                  <a
                    href={bctUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Đã thông báo Bộ Công Thương"
                    className="mb-3 block md:absolute md:left-0 md:top-0 md:mb-0"
                  >
                    <BctBadge alt="Đã thông báo Bộ Công Thương" height={40} />
                  </a>
                  <p className="m-0 mt-[10px] text-sm leading-5 text-[#7e7e7e] md:mt-0">
                    {t("businessReg")}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
