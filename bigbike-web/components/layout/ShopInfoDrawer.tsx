"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { Clock3, MapPin, Phone, X } from "lucide-react";
import { useHeaderUi } from "@/components/layout/HeaderUiContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

function MenuIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 22 22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="4" y1="6" x2="17.5" y2="6" />
      <line x1="4" y1="11" x2="19" y2="11" />
      <line x1="9" y1="16" x2="19" y2="16" />
    </svg>
  );
}

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
  const hoursLines = (hours.trim() || defaultHours)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const phones = [hotline, hotline2].map((phone) => phone.trim()).filter(Boolean);

  return (
    <>
      <Button
        variant="ghost"
        className={cn(
          "bb-icon-btn bb-header-info-trigger max-[1199px]:!hidden",
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
        className={cn("bb-header-info-sheet max-[1199px]:hidden", open && "is-open")}
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
