"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { Clock3, MapPin, Phone, X } from "lucide-react";
import { useHeaderUi } from "@/components/layout/HeaderUiContext";
import { Button } from "@/components/ui/button";
import { MenuIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { iconBtn } from "@/lib/ui-classes";
import { parsePhones, parseShopHours } from "@/lib/utils/shop";

// Drawer shell, inlined. .bb-header-info-sheet / .bb-header-info-content are KEPT
// as bare markers only because two rules can't be inlined onto this route-unaware
// component: the prefers-reduced-motion duration override, and the
// body:has(.bb-article-detail-page) overflow + closed-content display:none guard.
// `open` swaps closed→open inline (visibility/pointer-events snap in on open and
// wait for the fade on close); the overlay/content classes are otherwise dropped.
const infoSheet =
  "bb-header-info-sheet max-[1260px]:hidden fixed inset-0 z-[var(--bb-z-modal)] overflow-hidden pointer-events-none invisible [transition:visibility_0s_linear_0.5s]";
const infoSheetOpen = "is-open pointer-events-auto visible [transition:visibility_0s_linear_0s]";
const infoOverlay = "absolute inset-0 [border:none] bg-[rgba(0,0,0,0.64)] opacity-0 [transition:opacity_0.3s_ease]";
const infoContent =
  "bb-header-info-content absolute top-0 right-0 w-[min(100vw,645px)] h-full overflow-y-auto bg-white py-[50px] px-[70px] [transform:translateX(100%)] opacity-0 [transition:transform_0.5s_ease,opacity_0.5s_ease]";
const infoContentOpen = "[transform:translateX(0px)] opacity-100";
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
          iconBtn,
          "bb-header-info-trigger max-[1260px]:!hidden",
          open && "is-active",
        )}
        aria-label={t("shopInfoAriaLabel", { siteName })}
        aria-expanded={open}
        type="button"
        onClick={() => togglePanel("desktop-info")}
      >
        <MenuIcon className="4xl:size-[26px]" />
      </Button>

      <div
        className={cn(infoSheet, open && infoSheetOpen)}
        aria-hidden={!open}
      >
        <button
          type="button"
          className={cn(infoOverlay, open && "opacity-100")}
          aria-label={t("closeDrawer")}
          onClick={closePanel}
        />

        <div
          className={cn(infoContent, open && infoContentOpen)}
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
              <p className="m-0 text-muted-foreground text-[length:var(--fs-caption)] leading-[1.75]">{desc}</p>
            </div>

            <div className="mt-[70px]">
              <h2 className="m-0 text-foreground font-display text-ui-16 font-semibold uppercase">
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
