"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { Clock3, MapPin, Phone, X } from "lucide-react";
import { useHeaderUi } from "@/components/layout/HeaderUiContext";
import { Button } from "@/components/ui/button";
import { MenuIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { parsePhones, parseShopHours } from "@/lib/utils/shop";

// Drawer content (shell — bb-header-info-sheet/overlay/content + .is-open
// transitions — intentionally stays as CSS).
const liGrid = "grid grid-cols-[40px_minmax(0,1fr)] gap-4";
const copyText = "m-0 text-black leading-[1.7]";
const copyLink =
  "m-0 block text-black leading-[1.7] no-underline hover:text-[var(--bb-brand-primary)] focus-visible:text-[var(--bb-brand-primary)] focus-visible:outline-none";

type ShopInfoDrawerProps = {
  siteName: string;
  description: string;
  hours: string;
  address: string;
  hotline: string;
  hotline2: string;
  zaloUrl?: string;
  instagramUrl?: string;
};

export function ShopInfoDrawer({
  siteName,
  description,
  hours,
  address,
  hotline,
  hotline2,
}: ShopInfoDrawerProps) {
  const t = useTranslations("Header");
  const { isPanelOpen, togglePanel, closePanel } = useHeaderUi();
  const open = isPanelOpen("desktop-info");
  const desc = description.trim() || t("shopInfoDefaultDescription");
  const defaultHours = [
    t("shopInfoDefaultHoursLine1"),
    t("shopInfoDefaultHoursLine2"),
    t("shopInfoDefaultHoursLine3"),
  ].join("\n");
  const hoursLines = parseShopHours(hours, defaultHours);
  const phones = parsePhones(hotline, hotline2);

  return (
    <>
      <Button
        variant="ghost"
        className={cn(
          "bb-icon-btn bb-header-info-trigger max-[1260px]:!hidden",
          open && "is-active",
        )}
        aria-label={t("shopInfoAriaLabel", { siteName })}
        aria-expanded={open}
        type="button"
        onClick={() => togglePanel("desktop-info")}
      >
        <MenuIcon />
      </Button>

      <div
        className={cn("bb-header-info-sheet max-[1260px]:hidden", open && "is-open")}
        aria-hidden={!open}
      >
        <button
          type="button"
          className="bb-header-info-overlay"
          aria-label={t("closeDrawer")}
          onClick={closePanel}
        />

        <div
          className="bb-header-info-content"
          role="dialog"
          aria-modal="true"
          aria-label={t("shopInfoTitle", { siteName })}
        >
          <button
            type="button"
            className="absolute top-[52px] right-[70px] border-none bg-transparent text-foreground cursor-pointer hover:text-[var(--bb-brand-primary)] focus-visible:text-[var(--bb-brand-primary)] focus-visible:outline-none"
            aria-label={t("closeDrawer")}
            onClick={closePanel}
          >
            <X size={18} aria-hidden />
          </button>

          <div className="flex flex-col">
            <Image
              src="/wp/logo-1.png"
              alt={siteName}
              width={150}
              height={55}
              className="h-auto w-[150px]"
            />

            <div className="mt-[30px]">
              <p className="m-0 text-[#6f6f6f] text-[length:var(--fs-caption)] leading-[1.75]">{desc}</p>
            </div>

            <div className="mt-[70px]">
              <h2 className="m-0 text-foreground font-display text-[16px] font-semibold uppercase">
                {t("shopInfoContactHeading")}
              </h2>

              <ul className="grid gap-[30px] m-0 p-0 list-none">
                <li className={liGrid}>
                  <span className="text-[var(--bb-brand-primary)]" aria-hidden="true">
                    <Clock3 size={22} />
                  </span>
                  <div>
                    {hoursLines.map((line) => (
                      <p key={line} className={copyText}>
                        {line}
                      </p>
                    ))}
                  </div>
                </li>

                {address && (
                  <li className={liGrid}>
                    <span className="text-[var(--bb-brand-primary)]" aria-hidden="true">
                      <MapPin size={22} />
                    </span>
                    <div>
                      <p className={copyText}>{t("shopInfoStoreLabel", { siteName })}</p>
                      <p className={copyText}>{address}</p>
                    </div>
                  </li>
                )}

                {phones.length > 0 && (
                  <li className={liGrid}>
                    <span className="text-[var(--bb-brand-primary)]" aria-hidden="true">
                      <Phone size={22} />
                    </span>
                    <div>
                      {phones.map((phone) => (
                        <a key={phone} href={`tel:${phone.replace(/[\s.]/g, "")}`} className={copyLink}>
                          {phone}
                        </a>
                      ))}
                    </div>
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
