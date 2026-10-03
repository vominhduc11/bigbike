"use client";

import { useMemo } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { telHref } from "@/lib/utils/format";

type ContactItem = {
  key: "hotline" | "zalo" | "messenger";
  href: string;
  label: string;
  value: string;
  icon: string;
};

function validExternalUrl(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function extractDisplayValue(url: string): string {
  const match = /\/([^/?#]+)(?:[?#].*)?$/.exec(url);
  if (match?.[1]) return match[1];
  return new URL(url).hostname.replace(/^www\./i, "");
}

export type ContactChannelsData = {
  hotline?: string | null;
  zaloUrl?: string | null;
  messengerUrl?: string | null;
  zaloDisplay?: string | null;
  messengerDisplay?: string | null;
};

export function ContactChannels({ contacts }: { contacts: ContactChannelsData }) {
  const t = useTranslations("Support");
  const items = useMemo<ContactItem[]>(() => {
    const result: ContactItem[] = [];
    const hotline = contacts.hotline?.trim();
    const hotlineDigits = hotline?.replace(/\D/g, "") || "";
    if (hotline && hotlineDigits.length >= 7 && telHref(hotline) !== "tel:") {
      result.push({
        key: "hotline",
        href: telHref(hotline),
        label: t("hotline"),
        value: hotline.replace(/\s+/g, ""),
        icon: "/brand/home/chat-hotline.png",
      });
    }

    const zaloUrl = validExternalUrl(contacts.zaloUrl);
    if (zaloUrl) {
      result.push({
        key: "zalo",
        href: zaloUrl,
        label: t("zalo"),
        value: contacts.zaloDisplay?.trim() || extractDisplayValue(zaloUrl),
        icon: "/brand/home/chat-zalo.svg",
      });
    }

    const messengerUrl = validExternalUrl(contacts.messengerUrl);
    if (messengerUrl) {
      result.push({
        key: "messenger",
        href: messengerUrl,
        label: t("messenger"),
        value: contacts.messengerDisplay?.trim() || extractDisplayValue(messengerUrl),
        icon: "/brand/home/chat-messenger.png",
      });
    }
    return result;
  }, [contacts, t]);

  return (
    <div id="bigbike-contact-options">
      {items.length > 0 ? (
        items.map((item) => (
          <a
            key={item.key}
            href={item.href}
            target={item.key === "hotline" ? undefined : "_blank"}
            rel={item.key === "hotline" ? undefined : "nofollow noreferrer"}
            data-analytics-contact-channel={item.key === "hotline" ? "phone" : item.key}
            data-analytics-location="contact_panel"
            className="flex items-center gap-[var(--bb-contact-detail-gap)] px-4 py-2 text-[var(--bb-contact-text)] no-underline transition-none! hover:bg-[var(--bb-contact-hover-bg)]! hover:text-[var(--bb-contact-text)]! focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
          >
            <span className="inline-flex size-10 shrink-0" aria-hidden="true">
              <Image
                src={item.icon}
                width={40}
                height={40}
                alt=""
                unoptimized
                className="block size-10"
              />
            </span>
            <span className="m-0 min-w-0 break-words font-body text-a4-content leading-10 text-[var(--bb-contact-text)]">
              {item.label}: <strong className="font-bold">{item.value}</strong>
            </span>
          </a>
        ))
      ) : (
        <p className="px-4 py-2 font-body text-a4-content text-muted-foreground">
          {t("contactUnavailable")}
        </p>
      )}
    </div>
  );
}
