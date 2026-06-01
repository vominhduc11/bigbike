"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { Clock3, MapPin, Phone, X } from "lucide-react";
import { useHeaderUi } from "@/components/layout/HeaderUiContext";
import { Button } from "@/components/ui/button";
import { MenuIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { parsePhones, parseShopHours } from "@/lib/utils/shop";

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
            className="bb-header-info-close"
            aria-label={t("closeDrawer")}
            onClick={closePanel}
          >
            <X size={18} aria-hidden />
          </button>

          <div className="bb-header-info-body">
            <Image
              src="/wp/logo-1.png"
              alt={siteName}
              width={150}
              height={55}
              className="h-auto w-[150px]"
            />

            <div className="bb-header-info-desc">
              <p>{desc}</p>
            </div>

            <div className="bb-header-info-contact">
              <h2>{t("shopInfoContactHeading")}</h2>

              <ul className="bb-header-info-contact-list">
                <li>
                  <span className="bb-header-info-contact-icon" aria-hidden="true">
                    <Clock3 size={22} />
                  </span>
                  <div className="bb-header-info-contact-copy">
                    {hoursLines.map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </div>
                </li>

                {address && (
                  <li>
                    <span className="bb-header-info-contact-icon" aria-hidden="true">
                      <MapPin size={22} />
                    </span>
                    <div className="bb-header-info-contact-copy">
                      <p>{t("shopInfoStoreLabel", { siteName })}</p>
                      <p>{address}</p>
                    </div>
                  </li>
                )}

                {phones.length > 0 && (
                  <li>
                    <span className="bb-header-info-contact-icon" aria-hidden="true">
                      <Phone size={22} />
                    </span>
                    <div className="bb-header-info-contact-copy">
                      {phones.map((phone) => (
                        <a
                          key={phone}
                          href={`tel:${phone.replace(/[\s.]/g, "")}`}
                        >
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
