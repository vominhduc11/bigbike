import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AudioLines, BadgeCheck, BarChart3, Crown, Share2, Gem, Phone, Store } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PageHero } from "@/components/layout/PageHero";
import { ContactInfoList } from "@/components/ui/ContactInfoList";
import { ErrorState } from "@/components/ui/ErrorState";
import { getPageBySlug, listBrands, listPublicSettings } from "@/lib/api/public-api";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { resolveMediaUrl } from "@/lib/utils/format";
import { sanitizeRichHtml } from "@/lib/utils/html";
import { toBrandPath, toPagePath } from "@/lib/utils/routes";
import { pickSettingByPattern } from "@/lib/utils/settings";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("StaticPage");
  return buildPublicMetadata({
    title: t("aboutTitle"),
    description: t("aboutDescription"),
    canonicalPath: toPagePath("gioi-thieu"),
  });
}

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
        tile.highlight ? "bg-brand" : "bg-card border border-border shadow-sm"
      }`}
    >
      <Icon
        className={`w-9 h-9 shrink-0 ${tile.highlight ? "text-white" : "text-brand"}`}
        strokeWidth={1.5}
        aria-hidden="true"
      />
      <div className="min-w-0">
        <h4
          className={`font-display text-base font-semibold uppercase mb-1.5 leading-tight ${
            tile.highlight ? "text-white" : "text-foreground"
          }`}
        >
          {tile.title}
        </h4>
        <p
          className={`text-sm leading-[1.55] m-0 ${
            tile.highlight ? "text-white/90" : "text-muted-foreground"
          }`}
        >
          {tile.body}
        </p>
      </div>
    </div>
  );
}

export default async function AboutPage() {
  const [pageResult, brandsResult, settingsResult, t] = await Promise.all([
    getPageBySlug("gioi-thieu"),
    listBrands({ page: 1, size: 8, sort: "name:asc" }),
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
  const address = pickSettingByPattern(settings, [/address/i, /diachi/i, /dia_chi/i]) || "79/30/52 Âu Cơ, P.4, Q.11, Tp.HCM";
  const facebookUrl = pickSettingByPattern(settings, [/facebook/i]) || "https://www.facebook.com/bigbikegear";
  const facebookHandle = facebookUrl.replace(/^https?:\/\/(www\.)?/, "");

  return (
    <>
      {/* Hero render ngoài .bb-page để nằm sát header và không bị rule `.bb-page h1` ghi đè. */}
      <PageHero
        variant="welcome"
        title={t("aboutHeroTitle")}
        watermark="BigBike"
        illustration={{ src: page.heroImageUrl, alt: page.heroImageAlt }}
      />
      <section className="bb-page">
      <div className="bb-container">
        {/* Row 1: intro text + richtext + brand logos */}
        <div className="grid grid-cols-1 gap-6 pb-10 items-start lg:grid-cols-[4fr_5fr_3fr] lg:gap-[30px]">
          <div>
            <h3 className="font-display text-26 font-semibold uppercase text-foreground mb-4">{t("aboutBigbike")}</h3>
            <p className="text-muted-foreground text-base leading-snug m-0">{t("aboutSubtitle")}</p>
          </div>
          <article
            className="bb-richtext text-muted-foreground"
            dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(page.body) }}
          />
          {brands.length > 0 && (
            <div
              className="grid grid-cols-2 gap-x-6 gap-y-8 items-center justify-items-center"
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
                      <img src={logoSrc} alt={brand.name} loading="lazy" className="max-h-12 w-auto object-contain" />
                    ) : (
                      <span className="font-display font-semibold text-sm text-foreground text-center uppercase">{brand.name}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Row 2: quality section */}
        <div className="grid grid-cols-1 gap-[30px] py-[60px] items-start lg:grid-cols-[4fr_8fr]">
          <div>
            <h3 className="font-display text-26 font-semibold uppercase text-foreground mb-4 leading-tight">{t("aboutQualityTitle")}</h3>
            <p className="text-muted-foreground text-base leading-relaxed m-0">
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

        {/* Contact CTA */}
        <div className="py-10">
          <h3 className="font-display text-26 font-semibold uppercase text-foreground mb-3">{t("aboutConnectTitle")}</h3>
          <p className="text-muted-foreground mb-2">
            {t("aboutConnectBody1")}
          </p>
          <p className="text-muted-foreground mb-2">
            {t("aboutConnectBody2")}
          </p>
          <ContactInfoList
            className="mt-8"
            entries={[
              {
                icon: <Store className="w-[22px] h-[22px]" strokeWidth={1.5} />,
                label: t("mainStore"),
                content: <p className="text-muted-foreground text-sm leading-snug m-0">{address}</p>,
              },
              {
                icon: <Phone className="w-[22px] h-[22px]" strokeWidth={1.5} />,
                label: t("hotline"),
                content: (
                  <>
                    <p className="text-muted-foreground text-sm leading-snug m-0">028.62797251</p>
                    <p className="text-muted-foreground text-sm leading-snug m-0">{t("advisorThu")}</p>
                    <p className="text-muted-foreground text-sm leading-snug m-0">{t("advisorTri")}</p>
                    <p className="text-muted-foreground text-sm leading-snug mt-2 mb-0">{t("weekdayHours")}</p>
                    <p className="text-muted-foreground text-sm leading-snug m-0">{t("weekendHours")}</p>
                  </>
                ),
              },
              {
                icon: <Share2 className="w-[22px] h-[22px]" strokeWidth={1.5} />,
                label: t("facebook"),
                content: (
                  <p className="text-muted-foreground text-sm leading-snug m-0">
                    <a href={facebookUrl} target="_blank" rel="noopener noreferrer" className="bb-link">
                      {facebookHandle || "facebook.com/bigbikegear"}
                    </a>
                  </p>
                ),
              },
            ]}
          />
        </div>
      </div>
      </section>
    </>
  );
}
