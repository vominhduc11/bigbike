"use client";

import type { ReactNode } from "react";
import { Phone, Share2, Store } from "lucide-react";
import { useTranslations } from "next-intl";
import { LocalizedLink } from "@/components/i18n/LocalizedLink";
import { telHref } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

/* eslint-disable @next/next/no-img-element */

export type AboutBrandLogo = {
  id: string;
  name: string;
  slug: string;
  slugEn?: string | null;
  logoUrl: string;
  logoAlt: string;
};

export type AboutContactInfo = {
  address: string;
  hotline: string;
  hotline2: string;
  facebookUrl: string;
};

function ServiceTile({
  image,
  title,
  body,
  highlight,
}: {
  image: string;
  title: string;
  body: string;
  highlight: boolean;
}) {
  return (
    <div
      className={cn(
        "p-7 shadow-lg md:min-h-90",
        highlight ? "bg-brand text-white" : "bg-card text-foreground",
      )}
    >
      <img src={image} alt={title} className="mb-6 block h-auto max-w-full" />
      <h3 className="mb-4 font-cta text-a4-content font-bold uppercase leading-snug">
        {title}
      </h3>
      <p className="m-0 text-a4-content leading-relaxed">{body}</p>
    </div>
  );
}

function ContactItem({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-4 md:px-5">
      <span className="mt-0.5 shrink-0 text-brand">{icon}</span>
      <div className="min-w-0">
        <div className="mb-2 text-a4-content font-bold text-foreground">{label}</div>
        {children}
      </div>
    </div>
  );
}

export function AboutPageContent({
  brands,
  contact,
}: {
  brands: AboutBrandLogo[];
  contact: AboutContactInfo;
}) {
  const t = useTranslations("About");
  const services = [
    { title: t("service1Title"), body: t("service1Body"), image: "/brand/about/service-1.png", highlight: true },
    { title: t("service2Title"), body: t("service2Body"), image: "/brand/about/service-2.png", highlight: false },
    { title: t("service3Title"), body: t("service3Body"), image: "/brand/about/service-3.png", highlight: false },
    { title: t("service4Title"), body: t("service4Body"), image: "/brand/about/service-4.png", highlight: false },
    { title: t("service5Title"), body: t("service5Body"), image: "/brand/about/service-5.png", highlight: true },
  ];
  const intro = [t("intro1"), t("intro2"), t("intro3"), t("intro4")].filter(
    (paragraph) => paragraph.trim().length > 0,
  );
  const facebookHandle = contact.facebookUrl.replace(/^https?:\/\/(www\.)?/, "");

  return (
    <div className="mb-20 text-foreground">
      <div className="grid grid-cols-1 gap-8 md:grid-cols-12">
        <div className="md:col-span-4">
          <h2 className="m-0 font-cta text-a1-title font-medium uppercase leading-tight">
            {t("kicker")}
          </h2>
          <p className="m-0 mt-4 font-cta text-a3-section uppercase leading-snug text-foreground">
            {t("tagline")}
          </p>
        </div>

        <div className="md:col-span-5">
          {intro.map((paragraph, index) => (
            <p key={index} className="mb-5 text-a4-content leading-relaxed text-muted-foreground last:mb-0">
              {paragraph}
            </p>
          ))}
        </div>

        {brands.length > 0 ? (
          <div className="grid grid-cols-2 gap-5 md:col-span-3">
            {brands.map((brand) => (
              <LocalizedLink
                key={brand.id}
                kind="brand"
                viSlug={brand.slug}
                enSlug={brand.slugEn}
                title={brand.name}
                className="flex items-center justify-center"
              >
                <img src={brand.logoUrl} alt={brand.logoAlt} className="block h-auto max-w-full" />
              </LocalizedLink>
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-20 grid grid-cols-1 gap-8 md:grid-cols-3">
        <div className="max-w-sm">
          <h2 className="mb-5 font-cta text-a3-section font-medium uppercase leading-snug">
            {t("qualityHeading")}
          </h2>
          <p className="m-0 text-a4-content leading-relaxed text-muted-foreground">{t("qualityBody")}</p>
        </div>
        <div className="flex flex-col gap-8">
          {services.slice(0, 2).map((tile, index) => <ServiceTile key={index} {...tile} />)}
        </div>
        <div className="flex flex-col gap-8">
          {services.slice(2).map((tile, index) => <ServiceTile key={index + 2} {...tile} />)}
        </div>
      </div>

      <div className="mt-20">
        <h2 className="mb-4 font-cta text-a3-section font-medium uppercase leading-snug">{t("connectHeading")}</h2>
        <p className="m-0 mt-3 text-a4-content leading-relaxed text-muted-foreground">{t("connect1")}</p>
        <p className="m-0 mt-2 text-a4-content leading-relaxed text-muted-foreground">{t("connect2")}</p>

        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3 md:divide-x md:divide-border">
          {contact.address ? (
            <ContactItem icon={<Store size={28} strokeWidth={1.5} aria-hidden="true" />} label={t("storeLabel")}>
              <p className="m-0 text-a4-content leading-relaxed text-foreground">{contact.address}</p>
            </ContactItem>
          ) : null}

          {contact.hotline || contact.hotline2 ? (
            <ContactItem icon={<Phone size={28} strokeWidth={1.5} aria-hidden="true" />} label={t("hotlineLabel")}>
              {contact.hotline ? (
                <p className="m-0 text-a4-content leading-relaxed">
                  <a href={telHref(contact.hotline)} className="text-foreground hover:text-brand">{contact.hotline}</a>
                </p>
              ) : null}
              {contact.hotline2 ? (
                <p className="m-0 mt-1 text-a4-content leading-relaxed">
                  <a href={telHref(contact.hotline2)} className="text-foreground hover:text-brand">{contact.hotline2}</a>
                </p>
              ) : null}
            </ContactItem>
          ) : null}

          {contact.facebookUrl ? (
            <ContactItem icon={<Share2 size={28} strokeWidth={1.5} aria-hidden="true" />} label={t("facebookLabel")}>
              <p className="m-0 text-a4-content leading-relaxed">
                <a href={contact.facebookUrl} target="_blank" rel="noopener noreferrer" className="text-foreground hover:text-brand">
                  {facebookHandle}
                </a>
              </p>
            </ContactItem>
          ) : null}
        </div>
      </div>
    </div>
  );
}
