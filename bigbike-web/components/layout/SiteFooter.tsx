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
    <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-[3px] border-2 border-brand text-brand md:h-[34px] md:w-[34px]">
      {icon === "phone" ? (
        <PhoneCall size={22} strokeWidth={2.1} aria-hidden="true" />
      ) : (
        <Mail size={24} strokeWidth={2.1} aria-hidden="true" />
      )}
    </span>
  );
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
      id: "email",
      label: pickSetting(settings, ["contact_email"]),
      hrefValue: pickSetting(settings, ["contact_email"]),
      icon: "email" as const,
    },
  ].filter((item) => item.label);

  const footerLinks = buildFooterLinks(menuResult.data?.items ?? []);
  const socialLinks = buildSocialLinks(settings);
  const year = new Date().getFullYear();

  if (!menuResult.data) {
    console.warn(
      `[SiteFooter] Menu "${FOOTER_MENU_LOCATION}" could not be loaded.`,
      menuResult.error?.message ?? "unknown error",
    );
  }

  return (
    <footer className="bg-black text-white">
      <div className="bg-footer-top py-[60px] max-md:pb-0">
        <div className="bb-container">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-12">
            <div className="md:col-span-7">
              <h2 className="m-0 mb-10 font-cta text-[2.875rem] font-medium uppercase leading-[1.2] text-white md:mb-[2.857rem] md:text-[3.429rem] md:leading-[4.143rem] lg:max-w-[43rem]">
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
                      className="flex items-start gap-5 font-cta text-[2rem] font-medium leading-[1.18] text-white no-underline transition-colors hover:text-brand md:text-[2.143rem]"
                    >
                      <ContactIcon icon={item.icon} />
                      <span>{item.label}</span>
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
                <p className="m-0 mb-[2.286rem] text-base leading-[1.786rem] text-white">
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
                                className="text-base leading-[1.45] text-white no-underline transition-colors hover:text-brand"
                              >
                                {item.label}
                              </a>
                            ) : (
                              <Link
                                href={item.url}
                                className="text-base leading-[1.45] text-white no-underline transition-colors hover:text-brand"
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
                          <li key={item.id} className="mb-[1.1rem] last:mb-0">
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-block text-base leading-none text-white no-underline transition-colors hover:text-brand"
                            >
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

      <div className="bg-black py-[30px] max-md:pb-[15px] max-md:pt-0">
        <div className="bb-container relative">
          <ScrollToTopButton />
          <div className="grid grid-cols-1 items-center md:grid-cols-12 max-md:grid-cols-3">
            <div className="md:col-span-2 max-md:order-2 max-md:col-span-1 max-md:pt-[15px]">
              <Image
                src="/wp/logo-footer.png"
                alt={siteName}
                width={200}
                height={66}
                className="block h-auto w-[132px] max-md:w-[120px]"
              />
            </div>

            <div className="md:col-span-4 max-md:order-1 max-md:col-span-2 max-md:pt-[15px]">
              <p className="m-0 text-base text-white max-md:text-sm">
                {t("copyright", { year })}
              </p>
            </div>

            <div className="md:col-span-6 max-md:order-0 max-md:col-span-3 max-md:bg-footer-top max-md:pr-[33.333333%]">
              {bctUrl ? (
                <div>
                  <a
                    href={bctUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="BCT"
                  >
                    <div className="mb-2.5 block w-[200px] md:w-[250px]">
                      <BctBadge alt="BCT" height={95} />
                    </div>
                  </a>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
