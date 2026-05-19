import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { PageHero } from "@/components/layout/PageHero";
import { ContactInfoList } from "@/components/ui/ContactInfoList";
import { ErrorState } from "@/components/ui/ErrorState";
import { getPageBySlug, listPublicSettings } from "@/lib/api/public-api";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { toHomePath, toPagePath } from "@/lib/utils/routes";

export const metadata: Metadata = buildPublicMetadata({
  title: "Liên hệ",
  description: "Thông tin liên hệ BigBike — hotline, Zalo, Facebook, địa chỉ cửa hàng và bản đồ.",
  canonicalPath: toPagePath("lien-he"),
});

type Setting = { settingKey: string; settingValue: string };

function getSetting(settings: Setting[], key: string): string {
  return settings.find((s) => s.settingKey === key)?.settingValue?.trim() ?? "";
}

const PHONE_ASSET = "/wp/contact-phone.png";
const HERO_BG_CANDIDATES = ["/wp/contact-hero-bg.jpg", "/wp/contact-hero-bg.png"];

function publicAsset(relPath: string): string | null {
  return existsSync(join(process.cwd(), "public", relPath)) ? relPath : null;
}

export default async function ContactPage() {
  const [pageResult, settingsResult] = await Promise.all([getPageBySlug("lien-he"), listPublicSettings()]);

  if (!pageResult.data) {
    return (
      <section className="bb-page">
        <div className="bb-container">
          <ErrorState message={pageResult.error?.message ?? "Không tải được nội dung trang liên hệ."} />
        </div>
      </section>
    );
  }

  const page = pageResult.data;
  const settings = settingsResult.data ?? [];

  const hotline = getSetting(settings, "hotline") || "028.62797251";
  const hotline2 = getSetting(settings, "hotline_2");
  const address = getSetting(settings, "contact_address") || "79/30/52 Âu Cơ, Phường 14, Quận 11, TP.HCM";
  const zaloUrl = getSetting(settings, "zalo_url");
  const facebookUrl = getSetting(settings, "facebook_url");
  const mapUrl = getSetting(settings, "google_maps_url");

  const canEmbedMap = /^https?:\/\/(www\.)?google\.com\/maps[/?#]/.test(mapUrl);
  const fallbackMap =
    "https://www.google.com/maps?q=" + encodeURIComponent(address) + "&z=17&output=embed";
  const mapEmbedSrc = canEmbedMap ? mapUrl : fallbackMap;
  const directionsHref = "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(address);

  const hasPhoneAsset = publicAsset(PHONE_ASSET) !== null;
  const localHeroBg = HERO_BG_CANDIDATES.map(publicAsset).find(Boolean) ?? null;
  const heroImageUrl = page.heroImageUrl?.trim() || localHeroBg || undefined;
  const tel = (v: string) => `tel:${v.replace(/[^\d+]/g, "")}`;

  return (
    <>
      {/* Hero render ngoài .bb-page để rule global `.bb-page h1` không ghi đè tiêu đề. */}
      <PageHero
        variant="contact"
        title="Liên hệ"
        imageUrl={heroImageUrl}
        imageAlt={page.heroImageAlt}
        breadcrumb={[
          { label: "Trang chủ", href: toHomePath() },
          { label: "Liên hệ" },
        ]}
        illustration={hasPhoneAsset ? { src: PHONE_ASSET } : null}
      />

      <section className="bb-page">
        <div className="bb-container">
          <div className="grid grid-cols-1 gap-10 pt-8 pb-[60px] items-start lg:grid-cols-2 lg:gap-[60px]">
            {/* Thông tin liên hệ */}
            <div className="min-w-0">
              <h2 className="font-display text-[26px] font-semibold text-foreground mb-6">
                Thông tin liên hệ
              </h2>
              <ContactInfoList
                variant="list"
                entries={[
                  {
                    icon: (
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/><path d="M9 9v.01"/><path d="M9 12v.01"/><path d="M9 15v.01"/><path d="M9 18v.01"/></svg>
                    ),
                    label: "Cửa hàng chính",
                    content: <p className="text-muted-foreground leading-relaxed">{address}</p>,
                  },
                  {
                    icon: (
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.86 19.86 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                    ),
                    label: "Hotline",
                    content: (
                      <>
                        <p className="text-muted-foreground leading-relaxed">
                          <a href={tel(hotline)} className="bb-link">{hotline}</a>
                        </p>
                        {hotline2 ? (
                          <p className="text-muted-foreground leading-relaxed">
                            <a href={tel(hotline2)} className="bb-link">{hotline2}</a>
                          </p>
                        ) : null}
                        {zaloUrl ? (
                          <p className="text-muted-foreground leading-relaxed">
                            <a href={zaloUrl} target="_blank" rel="noopener noreferrer" className="bb-link">
                              Nhắn tin qua Zalo
                            </a>
                          </p>
                        ) : null}
                      </>
                    ),
                  },
                  ...(facebookUrl
                    ? [
                        {
                          icon: (
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12z"/></svg>
                          ),
                          label: "Facebook",
                          content: (
                            <p className="text-muted-foreground leading-relaxed break-words">
                              <a href={facebookUrl} target="_blank" rel="noopener noreferrer" className="bb-link">
                                {facebookUrl.replace(/^https?:\/\/(www\.)?/, "")}
                              </a>
                            </p>
                          ),
                        },
                      ]
                    : []),
                ]}
              />
            </div>

            {/* Hệ thống cửa hàng */}
            <div className="min-w-0">
              <h2 className="font-display text-[26px] font-semibold text-foreground mb-6">
                Hệ thống cửa hàng
              </h2>
              <div className="relative w-full h-[420px] bg-secondary border border-border">
                <iframe
                  title="Bản đồ cửa hàng BigBike"
                  src={mapEmbedSrc}
                  width="100%"
                  height="100%"
                  className="border-0 block h-full w-full"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  allowFullScreen
                />
                <div className="absolute bottom-4 left-4 right-4 sm:right-auto sm:max-w-[300px] bg-white border border-border p-4">
                  <div className="flex items-center gap-3">
                    <Image src="/brand/logo-primary.png" alt="BigBike" width={48} height={48} className="h-12 w-12 object-contain" />
                    <p className="font-display text-lg font-bold uppercase text-foreground">BigBike.vn</p>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{address}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Hotline: <a href={tel(hotline)} className="bb-link">{hotline}</a>
                  </p>
                </div>
              </div>
              <Button asChild variant="primary" className="mt-5 w-full">
                <a href={directionsHref} target="_blank" rel="noopener noreferrer">
                  Chỉ đường
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
