import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import {
  Clock, Globe, Mail, MapPin, MessageCircle, Music2, Phone, Send,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { WpStaticShell } from "@/components/wp/WpStaticShell";
import { LHtml, LText, LocalizedContentProvider } from "@/components/i18n/LocalizedContent";
import { Tr } from "@/components/i18n/Tr";
import { getContactPageLayout, getPageBySlug, listPublicSettings } from "@/lib/api/public-api";
import type { ContactBlock } from "@/lib/contracts/public";
import { buildPublicMetadata } from "@/lib/seo/metadata";
import { resolveMediaUrl, safeText, telHref } from "@/lib/utils/format";
import { sanitizeRichHtml } from "@/lib/utils/html";
import { toPagePath } from "@/lib/utils/routes";
import { pickSetting } from "@/lib/utils/settings";

/* eslint-disable @next/next/no-img-element */

const T = "/wp-content/themes/bigbike";

// Lucide icons the contact builder offers. `icon` may instead be an image path/URL (rendered as <img>).
const ICONS: Record<string, LucideIcon> = {
  Phone, MapPin, Clock, Mail, MessageCircle, Music2, Send, Globe,
};

// Seed layout used when the backend returns no blocks (mirrors V224) — keeps the page rendering
// even before the migration row exists.
const DEFAULT_BLOCKS: ContactBlock[] = [
  { type: "map", column: "main", sortOrder: 0, icon: "", label: "", bindKey: "contact_address", value: null, href: null, html: null },
  { type: "channel", column: "main", sortOrder: 1, icon: `${T}/images/contact-call-icon.png`, label: "Liên hệ với chúng tôi", bindKey: "hotline", value: null, href: null, html: null },
  { type: "channel", column: "main", sortOrder: 2, icon: `${T}/images/contact-call-icon.png`, label: "Hotline", bindKey: "hotline_2", value: null, href: null, html: null },
  { type: "address", column: "main", sortOrder: 3, icon: `${T}/images/contact-marker-icon.png`, label: "Cửa hàng", bindKey: "contact_address", value: null, href: null, html: null },
  { type: "hours", column: "main", sortOrder: 4, icon: `${T}/images/contact-calendar-icon.png`, label: "Giờ làm việc", bindKey: null, value: null, href: null, html: null },
  { type: "channel", column: "online", sortOrder: 5, icon: "", label: "Zalo", bindKey: "zalo_url", value: null, href: null, html: null },
  { type: "channel", column: "online", sortOrder: 6, icon: "", label: "Facebook", bindKey: "facebook_url", value: null, href: null, html: null },
  { type: "channel", column: "online", sortOrder: 7, icon: "", label: "Hotline", bindKey: "hotline", value: null, href: null, html: null },
];

export async function generateMetadata(): Promise<Metadata> {
  const [locale, t] = await Promise.all([getLocale(), getTranslations("StaticPage")]);
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
  const [pageResult, settingsResult, layoutResult] = await Promise.all([
    getPageBySlug("lien-he", locale),
    listPublicSettings(locale),
    getContactPageLayout(locale),
  ]);

  const page = pageResult.data;
  const settings = settingsResult.data ?? [];
  const pageTitle = safeText(page?.title, "Liên hệ");
  const sanitizedBody = page?.body ? sanitizeRichHtml(page.body) : "";

  // Admin-managed layout; fall back to the in-code default when the backend has no row yet.
  const blocks = (layoutResult.data && layoutResult.data.length > 0)
    ? [...layoutResult.data].sort((a, b) => a.sortOrder - b.sortOrder)
    : DEFAULT_BLOCKS;

  // Map embed: built from the first enabled `map` block's bound address.
  const mapBlock = blocks.find((b) => b.type === "map");
  const mapAddress = mapBlock
    ? (mapBlock.bindKey ? pickSetting(settings, [mapBlock.bindKey]) : mapBlock.value ?? "")
    : "";
  const mapEmbedSrc = mapAddress
    ? `https://www.google.com/maps?q=${encodeURIComponent(mapAddress)}&z=17&output=embed`
    : "";

  const mainBlocks = blocks.filter((b) => b.column !== "online" && b.type !== "map");
  const onlineBlocks = blocks.filter((b) => b.column === "online" && b.type !== "map");

  // page-contact.php layout, but every row is now admin-managed via the contact page builder.
  return (
    <LocalizedContentProvider kind="page" slug="lien-he">
    <WpStaticShell title={pageTitle} breadcrumb={[]} showHero={false} mainClassName="pb-40 contact-page">
      {mapEmbedSrc ? (
        <div className="iframe">
          <iframe
            title={pageTitle}
            src={mapEmbedSrc}
            width="100%"
            height="375"
            style={{ border: 0 }}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        </div>
      ) : null}

      <div className="container">
        <div className="row">
          <div className="col-md-12">
            <div className="static-page wyswyg">
              <div className="row">
                <div className="col-md-6">
                  <div className="information" data-bb-focus="contact_main contact_social">
                    <div className="title">
                      <h1 style={{ fontSize: "24px" }}><LText field="title">{pageTitle}</LText></h1>
                      {sanitizedBody ? (
                        <LHtml field="body" viHtml={sanitizedBody} />
                      ) : null}
                    </div>
                    <div className="desc">
                      <ul>
                        {mainBlocks.map((block, i) => (
                          <MainRow key={i} block={block} settings={settings} />
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="contact-form">
                    <div className="title">
                      <h3><Tr ns="Contact" k="onlineHeading" /></h3>
                      <p><Tr ns="Contact" k="onlineDesc" /></p>
                    </div>
                    <div className="webform">
                      <ul>
                        {onlineBlocks.map((block, i) => (
                          <OnlineRow key={i} block={block} settings={settings} />
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </WpStaticShell>
    </LocalizedContentProvider>
  );
}

// ── Render helpers ────────────────────────────────────────────────────────────

type Settings = Parameters<typeof pickSetting>[0];

function resolveValue(block: ContactBlock, settings: Settings): string {
  if (block.bindKey) return pickSetting(settings, [block.bindKey]);
  return block.value ?? "";
}

function resolveHref(block: ContactBlock, value: string): string | undefined {
  if (block.href) return block.href;
  if (!value) return undefined;
  const k = block.bindKey ?? "";
  if (k === "contact_email") return `mailto:${value}`;
  if (k.startsWith("hotline")) return telHref(value);
  if (k.endsWith("_url")) return value;
  return value.startsWith("http") ? value : telHref(value);
}

function stripUrl(value: string): string {
  return value.replace(/^https?:\/\/(www\.)?/, "");
}

function BlockIcon({ icon, label }: { icon: string | null; label: string | null }) {
  if (!icon) return null;
  // Image icon (uploaded to the media library / MinIO, or a theme asset) → normalize + render <img>.
  if (icon.startsWith("/") || icon.startsWith("http")) {
    const src = resolveMediaUrl(icon) ?? icon;
    return <img src={src} alt={label || ""} />;
  }
  const Lucide = ICONS[icon];
  return Lucide ? <Lucide size={28} aria-hidden /> : null;
}

function MainRow({ block, settings }: { block: ContactBlock; settings: Settings }) {
  if (block.type === "richtext") {
    const html = block.html ? sanitizeRichHtml(block.html) : "";
    if (!html) return null;
    return (
      <li className="row">
        <div className="text col">
          {block.label ? <p>{block.label}</p> : null}
          <div dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      </li>
    );
  }

  if (block.type === "hours") {
    const weekday = pickSetting(settings, ["opening_hours_weekday"]);
    const weekend = pickSetting(settings, ["opening_hours_weekend"]);
    const holiday = pickSetting(settings, ["opening_hours_holiday"]);
    if (!weekday && !weekend && !holiday) return null;
    return (
      <li className="row">
        <div className="icon col"><BlockIcon icon={block.icon} label={block.label} /></div>
        <div className="text col">
          {block.label ? <p>{block.label}</p> : null}
          {weekday ? <p><b>{weekday}</b></p> : null}
          {weekend ? <p><b>{weekend}</b></p> : null}
          {holiday ? <p><b>{holiday}</b></p> : null}
        </div>
      </li>
    );
  }

  // channel | address
  const value = resolveValue(block, settings);
  if (!value) return null;
  const href = block.type === "channel" ? resolveHref(block, value) : undefined;
  return (
    <li className="row">
      <div className="icon col"><BlockIcon icon={block.icon} label={block.label} /></div>
      <div className="text col">
        {block.label ? <p>{block.label}</p> : null}
        <p>
          <b>
            {href ? (
              <a href={href} {...(href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{value}</a>
            ) : value}
          </b>
        </p>
      </div>
    </li>
  );
}

function OnlineRow({ block, settings }: { block: ContactBlock; settings: Settings }) {
  if (block.type === "richtext") {
    const html = block.html ? sanitizeRichHtml(block.html) : "";
    if (!html) return null;
    return (
      <li className="row">
        <div className="text col">
          {block.label ? <p>{block.label}</p> : null}
          <div dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      </li>
    );
  }

  const value = resolveValue(block, settings);
  if (!value) return null;
  const href = resolveHref(block, value);
  const isUrl = href?.startsWith("http") ?? false;
  const linkText = isUrl ? stripUrl(value) : value;
  return (
    <li className="row">
      <div className="text col">
        {block.label ? <p>{block.label}</p> : null}
        <p>
          <b>
            {href ? (
              <a href={href} {...(isUrl ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{linkText}</a>
            ) : value}
          </b>
        </p>
      </div>
    </li>
  );
}
