import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHero } from "@/components/layout/PageHero";
import { Button } from "@/components/ui/button";
import { ContactInfoList } from "@/components/ui/ContactInfoList";
import { ErrorState } from "@/components/ui/ErrorState";
import { getPageBySlug, listPublicSettings } from "@/lib/api/public-api";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { safeText } from "@/lib/utils/format";
import { sanitizeRichHtml } from "@/lib/utils/html";
import { toHomePath, toPagePath } from "@/lib/utils/routes";
import { pickSetting } from "@/lib/utils/settings";

const PHONE_ASSET = "/wp/contact-phone.png";
const HERO_BG_CANDIDATES = ["/wp/contact-hero-bg.jpg", "/wp/contact-hero-bg.png"];

function publicAsset(relPath: string): string | null {
  return existsSync(join(process.cwd(), "public", relPath)) ? relPath : null;
}

export async function generateMetadata(): Promise<Metadata> {
  const [locale, t] = await Promise.all([
    getLocale(),
    getTranslations("StaticPage"),
  ]);
  const pageResult = await getPageBySlug("lien-he", locale);
  const page = pageResult.data;

  return buildPublicMetadata({
    title: page?.seo?.title ?? page?.title ?? t("contactTitle"),
    description: page?.seo?.description ?? t("contactDescription"),
    canonicalPath: page?.seo?.canonicalUrl ?? toPagePath("lien-he"),
    noIndex: page?.seo?.noIndex ?? false,
  });
}

export default async function ContactPage() {
  const locale = await getLocale();
  const [pageResult, settingsResult, t, tBreadcrumb] = await Promise.all([
    getPageBySlug("lien-he", locale),
    listPublicSettings(),
    getTranslations("StaticPage"),
    getTranslations("Breadcrumb"),
  ]);

  if (!pageResult.data) {
    return (
      <section className="bb-page">
        <div className="bb-container">
          <ErrorState message={pageResult.error?.message ?? t("contactLoadFailed")} />
        </div>
      </section>
    );
  }

  const page = pageResult.data;
  const settings = settingsResult.data ?? [];
  const pageTitle = safeText(page.title, t("contactTitle"));

  const hotline = pickSetting(settings, ["hotline"]);
  const hotline2 = pickSetting(settings, ["hotline_2"]);
  const address = pickSetting(settings, ["contact_address"]);
  const zaloUrl = pickSetting(settings, ["zalo_url"]);
  const facebookUrl = pickSetting(settings, ["facebook_url"]);
  const mapUrl = pickSetting(settings, ["google_maps_url"]);

  const canEmbedMap = /^https?:\/\/(www\.)?google\.com\/maps[/?#]/.test(mapUrl);
  const fallbackMap = address
    ? `https://www.google.com/maps?q=${encodeURIComponent(address)}&z=17&output=embed`
    : "";
  const mapEmbedSrc = canEmbedMap ? mapUrl : fallbackMap;
  const directionsHref = address
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`
    : "";

  const hasPhoneAsset = publicAsset(PHONE_ASSET) !== null;
  const localHeroBg = HERO_BG_CANDIDATES.map(publicAsset).find(Boolean) ?? null;
  const heroImageUrl = page.heroImageUrl?.trim() || localHeroBg || undefined;
  const tel = (v: string) => `tel:${v.replace(/[^\d+]/g, "")}`;
  const sanitizedBody = page.body ? sanitizeRichHtml(page.body) : "";

  return (
    <>
      <PageHero
        variant="contact"
        title={page.heroTitle ?? pageTitle}
        imageUrl={heroImageUrl}
        imageAlt={page.heroImageAlt}
        breadcrumb={[
          { label: tBreadcrumb("home"), href: toHomePath() },
          { label: t("contactBreadcrumb") },
        ]}
        illustration={hasPhoneAsset ? { src: PHONE_ASSET } : null}
      />

      <section className="bb-page">
        <div className="bb-container">
          {sanitizedBody ? (
            <article
              className="bb-richtext pt-8"
              dangerouslySetInnerHTML={{ __html: sanitizedBody }}
            />
          ) : null}

          <div className="grid grid-cols-1 items-start gap-10 pb-[60px] pt-8 lg:grid-cols-2 lg:gap-[60px]">
            <div className="min-w-0">
              <h2 className="mb-6 font-display text-[26px] font-semibold text-foreground">
                {t("contactInfoHeading")}
              </h2>
              <ContactInfoList
                variant="list"
                entries={[
                  ...(address
                    ? [{
                        icon: (
                          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/><path d="M9 9v.01"/><path d="M9 12v.01"/><path d="M9 15v.01"/><path d="M9 18v.01"/></svg>
                        ),
                        label: t("mainStore"),
                        content: <p className="leading-relaxed text-muted-foreground">{address}</p>,
                      }]
                    : []),
                  ...((hotline || hotline2 || zaloUrl)
                    ? [{
                        icon: (
                          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.86 19.86 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                        ),
                        label: t("hotline"),
                        content: (
                          <>
                            {hotline ? (
                              <p className="leading-relaxed text-muted-foreground">
                                <a href={tel(hotline)} className="bb-link">
                                  {hotline}
                                </a>
                              </p>
                            ) : null}
                            {hotline2 ? (
                              <p className="leading-relaxed text-muted-foreground">
                                <a href={tel(hotline2)} className="bb-link">
                                  {hotline2}
                                </a>
                              </p>
                            ) : null}
                            {zaloUrl ? (
                              <p className="leading-relaxed text-muted-foreground">
                                <a
                                  href={zaloUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="bb-link"
                                >
                                  {t("chatViaZalo")}
                                </a>
                              </p>
                            ) : null}
                          </>
                        ),
                      }]
                    : []),
                  ...(facebookUrl
                    ? [{
                        icon: (
                          <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12z"/></svg>
                        ),
                        label: t("facebook"),
                        content: (
                          <p className="break-words leading-relaxed text-muted-foreground">
                            <a
                              href={facebookUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="bb-link"
                            >
                              {facebookUrl.replace(/^https?:\/\/(www\.)?/, "")}
                            </a>
                          </p>
                        ),
                      }]
                    : []),
                ]}
              />
            </div>

            {(mapEmbedSrc || address || hotline) ? (
              <div className="min-w-0">
                <h2 className="mb-6 font-display text-[26px] font-semibold text-foreground">
                  {t("storeSystemHeading")}
                </h2>
                {mapEmbedSrc ? (
                  <div className="relative h-[420px] w-full border border-border bg-secondary">
                    <iframe
                      title={t("mapTitle")}
                      src={mapEmbedSrc}
                      width="100%"
                      height="100%"
                      className="block h-full w-full border-0"
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      allowFullScreen
                    />
                    {(address || hotline) ? (
                      <div className="absolute bottom-4 left-4 right-4 border border-border bg-white p-4 sm:right-auto sm:max-w-[300px]">
                        <div className="flex items-center gap-3">
                          <Image
                            src="/brand/logo-primary.png"
                            alt={pageTitle}
                            width={48}
                            height={48}
                            className="h-12 w-12 object-contain"
                          />
                          <p className="font-display text-lg font-bold uppercase text-foreground">
                            {pageTitle}
                          </p>
                        </div>
                        {address ? (
                          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                            {address}
                          </p>
                        ) : null}
                        {hotline ? (
                          <p className="mt-1 text-sm text-muted-foreground">
                            {t("hotline")}:{" "}
                            <a href={tel(hotline)} className="bb-link">
                              {hotline}
                            </a>
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {directionsHref ? (
                  <Button asChild variant="primary" className="mt-5 w-full">
                    <a href={directionsHref} target="_blank" rel="noopener noreferrer">
                      {t("directions")}
                    </a>
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </>
  );
}
