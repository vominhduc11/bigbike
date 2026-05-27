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

const SOCIAL_ICON_IDS = new Set(["facebook"]);

function hasSocialIcon(id: string): boolean {
  return SOCIAL_ICON_IDS.has(id);
}

function SocialIcon({ id }: { id: string }) {
  if (id === "facebook") {
    return (
      <svg
        className="absolute left-0 top-1/2 -translate-y-1/2 text-brand-inverse"
        width="18"
        height="18"
        viewBox="0 0 320 512"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M279.14 288l14.22-92.66h-88.91v-60.13c0-25.35 12.42-50.06 52.24-50.06h40.42V6.26S260.43 0 225.36 0c-73.22 0-121.08 44.38-121.08 124.72v70.62H22.89V288h81.39v224h100.17V288z" />
      </svg>
    );
  }
  return null;
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
                <p className="m-0 mb-7 text-[15px] leading-[1.65] text-white md:mb-[2.286rem] md:text-base md:leading-[1.786rem]">
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
                      <ul className="m-0 list-none p-0">
                        {socialLinks.map((item) => (
                          <li key={item.id} className="mb-[1.571rem] last:mb-0">
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`inline-block text-base leading-none text-white no-underline transition-colors hover:text-brand-inverse ${hasSocialIcon(item.id) ? "relative pl-[2.857rem]" : ""}`}
                            >
                              <SocialIcon id={item.id} />
                              {item.label}
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

      <div className="bg-black py-[30px] max-md:pb-[calc(20px_+_var(--bb-mobile-nav-height)_+_env(safe-area-inset-bottom))] max-md:pt-6">
        <div className="bb-container relative">
          <ScrollToTopButton />
          <div className="grid grid-cols-1 items-center gap-5 md:grid-cols-12 md:gap-0">
            <div className="md:col-span-2 max-md:order-2">
              <Image
                src="/wp/logo-footer.png"
                alt={siteName}
                width={200}
                height={66}
                className="block h-auto w-[132px] max-md:w-[118px]"
              />
            </div>

            <div className="md:col-span-4 max-md:order-3">
              <p className="m-0 max-w-[22rem] text-sm leading-[1.45] text-white md:text-base">
                {t("copyright")}
              </p>
            </div>

            <div className="md:col-span-6 max-md:order-1 max-md:bg-footer-top max-md:pr-14">
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
