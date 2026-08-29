"use client";

import { useMemo, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { MessagesSquare, Phone } from "lucide-react";
import { ZaloIcon } from "@/components/ui/ZaloIcon";
import type { ChatContact } from "@/lib/api/client-api";
import { telHref } from "@/lib/utils/format";

type ContactItem = {
  key: "hotline" | "zalo" | "messenger";
  href: string;
  label: string;
  value: string;
  icon: ReactNode;
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

export function BigBikeContactPanel({ contacts }: { contacts: ChatContact }) {
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
        icon: <Phone className="size-6" aria-hidden="true" />,
      });
    }

    const zaloUrl = validExternalUrl(contacts.zaloUrl);
    if (zaloUrl) {
      result.push({
        key: "zalo",
        href: zaloUrl,
        label: t("zalo"),
        value: contacts.zaloDisplay?.trim() || t("openZalo"),
        icon: <ZaloIcon className="size-8" />,
      });
    }

    const messengerUrl = validExternalUrl(contacts.messengerUrl);
    if (messengerUrl) {
      result.push({
        key: "messenger",
        href: messengerUrl,
        label: t("messenger"),
        value: contacts.messengerDisplay?.trim() || t("openMessenger"),
        icon: <MessagesSquare className="size-6" aria-hidden="true" />,
      });
    }
    return result;
  }, [contacts, t]);

  return (
    <section aria-labelledby="bigbike-contact-heading" className="border border-border bg-background p-4">
      <div className="border-l-4 border-chat pl-3">
        <h3 id="bigbike-contact-heading" className="font-cta text-b4-action font-semibold uppercase tracking-wide text-foreground">
          {t("contactTitle")}
        </h3>
        <p className="mt-2 font-body text-a5-meta leading-relaxed text-muted-foreground">
          {t("contactDescription")}
        </p>
      </div>
      <div id="bigbike-contact-options" className="mt-4 grid gap-3">
        {items.length > 0 ? items.map((item) => (
          <a
            key={item.key}
            href={item.href}
            target={item.key === "hotline" ? undefined : "_blank"}
            rel={item.key === "hotline" ? undefined : "nofollow noreferrer"}
            className="flex min-h-16 items-center gap-3 border border-border bg-background px-4 py-3 text-foreground no-underline transition-colors hover:border-chat hover:bg-cyan/10 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
          >
            <span className="inline-flex size-11 shrink-0 items-center justify-center border border-border bg-secondary text-chat" aria-hidden="true">
              {item.icon}
            </span>
            <span className="min-w-0">
              <span className="block font-cta text-b5-label font-semibold uppercase tracking-wide text-muted-foreground">
                {item.label}
              </span>
              <strong className="mt-1 block break-words font-body text-a4-content text-foreground">{item.value}</strong>
            </span>
          </a>
        )) : (
          <p className="border border-border bg-secondary p-4 font-body text-a4-content text-muted-foreground">
            {t("contactUnavailable")}
          </p>
        )}
      </div>
    </section>
  );
}
