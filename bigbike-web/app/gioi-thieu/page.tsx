import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import {
  AudioLines,
  BadgeCheck,
  BarChart3,
  Crown,
  Gem,
  Phone,
  Share2,
  Store,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PageHero } from "@/components/layout/PageHero";
import { ContactInfoList } from "@/components/ui/ContactInfoList";
import { ErrorState } from "@/components/ui/ErrorState";
import { getPageBySlug, listBrands, listPublicSettings } from "@/lib/api/public-api";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { resolveMediaUrl } from "@/lib/utils/format";
import { sanitizeRichHtml } from "@/lib/utils/html";
import { toBrandPath, toPagePath } from "@/lib/utils/routes";
import { pickSetting } from "@/lib/utils/settings";

type ServiceTile = {
  title: string;
  body: string;
  highlight: boolean;
  icon: LucideIcon;
};

type ServiceTileDef = {
  titleKey: string;
  bodyKey: string;
  highlight: boolean;
  icon: LucideIcon;
};

const SERVICE_TILE_DEFS: ServiceTileDef[] = [
  {
    titleKey: "serviceTiles.warrantyTitle",
    bodyKey: "serviceTiles.warrantyBody",
    highlight: false,
    icon: BadgeCheck,
  },
  {
    titleKey: "serviceTiles.genuineTitle",
    bodyKey: "serviceTiles.genuineBody",
    highlight: true,
    icon: Gem,
  },
  {
    titleKey: "serviceTiles.adviceTitle",
    bodyKey: "serviceTiles.adviceBody",
    highlight: false,
    icon: Crown,
  },
  {
    titleKey: "serviceTiles.deliveryTitle",
    bodyKey: "serviceTiles.deliveryBody",
    highlight: true,
    icon: AudioLines,
  },
  {
    titleKey: "serviceTiles.priceTitle",
    bodyKey: "serviceTiles.priceBody",
    highlight: false,
    icon: BarChart3,
  },
];

function ServiceTileCard({ tile }: { tile: ServiceTile }) {
  const Icon = tile.icon;
  return (
    <div
      className={`flex gap-4 p-5 ${
        tile.highlight ? "bg-brand" : "border border-border bg-card shadow-sm"
      }`}
    >
      <Icon
        className={`h-9 w-9 shrink-0 ${tile.highlight ? "text-white" : "text-brand"}`}
        strokeWidth={1.5}
        aria-hidden="true"
      />
      <div className="min-w-0">
        <h4
          className={`mb-1.5 font-display text-base font-semibold uppercase leading-tight ${
            tile.highlight ? "text-white" : "text-foreground"
          }`}
        >
          {tile.title}
        </h4>
        <p
          className={`m-0 text-sm leading-[1.55] ${
            tile.highlight ? "text-white/90" : "text-muted-foreground"
          }`}
        >
          {tile.body}
        </p>
      </div>
    </div>
  );
}

export async function generateMetadata(): Promise<Metadata> {
  const [locale, t] = await Promise.all([
    getLocale(),
    getTranslations("StaticPage"),
  ]);
  const pageResult = await getPageBySlug("gioi-thieu", locale);
  const page = pageResult.data;

  return buildPublicMetadata({
    title: page?.seo?.title ?? page?.title ?? t("aboutTitle"),
    description: page?.seo?.description ?? t("aboutDescription"),
    canonicalPath: page?.seo?.canonicalUrl ?? toPagePath("gioi-thieu"),
    noIndex: page?.seo?.noIndex ?? false,
  });
}

export default async function AboutPage() {
  const locale = await getLocale();
  const [pageResult, brandsResult, settingsResult, t] = await Promise.all([
    getPageBySlug("gioi-thieu", locale),
    listBrands({ page: 1, size: 8, sort: "name:asc", lang: locale }),
    listPublicSettings(),
    getTranslations("StaticPage"),
  ]);

  if (!pageResult.data && pageResult.error?.status === 404) {
    notFound();
  }

  if (!pageResult.data) {
    return (
      <section className="bb-page">
        <div className="bb-container">
          <ErrorState message={pageResult.error?.message ?? t("aboutLoadFailed")} />
        </div>
      </section>
    );
  }

  const page = pageResult.data;
  const brands = brandsResult.data ?? [];
  const settings = settingsResult.data ?? [];
  const pageTitle = page.heroTitle ?? page.title ?? t("aboutHeroTitle");
  const address = pickSetting(settings, ["contact_address"]);
  const hotline = pickSetting(settings, ["hotline"]);
  const hotline2 = pickSetting(settings, ["hotline_2"]);
  const facebookUrl = pickSetting(settings, ["facebook_url"]);
  const facebookHandle = facebookUrl.replace(/^https?:\/\/(www\.)?/, "");

  return (
    <>
      <PageHero
        variant="welcome"
        title={pageTitle}
        watermark="BigBike"
        illustration={{ src: page.heroImageUrl, alt: page.heroImageAlt }}
      />
      <section className="bb-page">
        <div className="bb-container">
          <div className="grid grid-cols-1 items-start gap-6 pb-10 lg:grid-cols-[4fr_5fr_3fr] lg:gap-[30px]">
            <div>
              <h3 className="mb-4 font-display text-26 font-semibold uppercase text-foreground">
                {t("aboutBigbike")}
              </h3>
              <p className="m-0 text-base leading-snug text-muted-foreground">
                {t("aboutSubtitle")}
              </p>
            </div>
            <article
              className="bb-richtext text-muted-foreground"
              dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(page.body) }}
            />
            {brands.length > 0 ? (
              <div
                className="grid grid-cols-2 items-center justify-items-center gap-x-6 gap-y-8"
                aria-label={t("brandDistributors")}
              >
                {brands.slice(0, 8).map((brand) => {
                  const logoSrc = resolveMediaUrl(brand.logo?.url?.trim());
                  return (
                    <Link
                      key={brand.id}
                      href={toBrandPath(brand.slug)}
                      className="flex items-center justify-center no-underline transition-opacity duration-150 hover:opacity-70"
                    >
                      {logoSrc ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={logoSrc}
                          alt={brand.name}
                          loading="lazy"
                          className="max-h-12 w-auto object-contain"
                        />
                      ) : (
                        <span className="text-center font-display text-sm font-semibold uppercase text-foreground">
                          {brand.name}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-1 items-start gap-[30px] py-[60px] lg:grid-cols-[4fr_8fr]">
            <div>
              <h3 className="mb-4 font-display text-26 font-semibold uppercase leading-tight text-foreground">
                {t("aboutQualityTitle")}
              </h3>
              <p className="m-0 text-base leading-relaxed text-muted-foreground">
                {t("aboutQualityBody")}
              </p>
            </div>
            <div className="flex flex-col gap-5">
              {SERVICE_TILE_DEFS.map((tile) => (
                <ServiceTileCard
                  key={tile.titleKey}
                  tile={{
                    title: t(tile.titleKey),
                    body: t(tile.bodyKey),
                    highlight: tile.highlight,
                    icon: tile.icon,
                  }}
                />
              ))}
            </div>
          </div>

          {(address || hotline || hotline2 || facebookUrl) ? (
            <div className="py-10">
              <h3 className="mb-3 font-display text-26 font-semibold uppercase text-foreground">
                {t("aboutConnectTitle")}
              </h3>
              <p className="mb-2 text-muted-foreground">{t("aboutConnectBody1")}</p>
              <p className="mb-2 text-muted-foreground">{t("aboutConnectBody2")}</p>
              <ContactInfoList
                className="mt-8"
                entries={[
                  ...(address
                    ? [{
                        icon: <Store className="h-[22px] w-[22px]" strokeWidth={1.5} />,
                        label: t("mainStore"),
                        content: (
                          <p className="m-0 text-sm leading-snug text-muted-foreground">
                            {address}
                          </p>
                        ),
                      }]
                    : []),
                  ...((hotline || hotline2)
                    ? [{
                        icon: <Phone className="h-[22px] w-[22px]" strokeWidth={1.5} />,
                        label: t("hotline"),
                        content: (
                          <>
                            {hotline ? (
                              <p className="m-0 text-sm leading-snug text-muted-foreground">
                                <a
                                  href={`tel:${hotline.replace(/[^\d+]/g, "")}`}
                                  className="bb-link"
                                >
                                  {hotline}
                                </a>
                              </p>
                            ) : null}
                            {hotline2 ? (
                              <p className="m-0 text-sm leading-snug text-muted-foreground">
                                <a
                                  href={`tel:${hotline2.replace(/[^\d+]/g, "")}`}
                                  className="bb-link"
                                >
                                  {hotline2}
                                </a>
                              </p>
                            ) : null}
                          </>
                        ),
                      }]
                    : []),
                  ...(facebookUrl
                    ? [{
                        icon: <Share2 className="h-[22px] w-[22px]" strokeWidth={1.5} />,
                        label: t("facebook"),
                        content: (
                          <p className="m-0 text-sm leading-snug text-muted-foreground">
                            <a
                              href={facebookUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="bb-link"
                            >
                              {facebookHandle}
                            </a>
                          </p>
                        ),
                      }]
                    : []),
                ]}
              />
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}
