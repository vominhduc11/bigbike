"use client";

import Image from "next/image";
import { Clock, MapPin, Menu, Phone } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

type ShopInfoDrawerProps = {
  siteName: string;
  description: string;
  hours: string;
  address: string;
  hotline: string;
  hotline2: string;
  zaloUrl: string;
  instagramUrl: string;
};

/**
 * Khung "Về BigBike" — off-canvas trượt từ phải: mô tả shop + thông tin liên hệ.
 * Mở bằng nút ☰ ở header (chỉ hiện trên desktop ≥ 1200px; dưới mức đó header
 * dùng nút ☰ của menu di động). Bám off-canvas WP `information-slide-bigbike`.
 */
export function ShopInfoDrawer({
  siteName,
  description,
  hours,
  address,
  hotline,
  hotline2,
  zaloUrl,
  instagramUrl,
}: ShopInfoDrawerProps) {
  const t = useTranslations("Header");
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
  const phones = [hotline, hotline2].map((p) => p.trim()).filter(Boolean);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          className="bb-icon-btn max-[1199px]:!hidden"
          aria-label={t("shopInfoAriaLabel", { siteName })}
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="w-full overflow-y-auto p-0 sm:max-w-lg">
        <SheetTitle className="sr-only">{t("shopInfoTitle", { siteName })}</SheetTitle>
        <SheetDescription className="sr-only">
          {t("shopInfoDescription", { siteName })}
        </SheetDescription>

        <div className="flex flex-col gap-7 p-7">
          <Image
            src="/wp/logo-1.png"
            alt={siteName}
            width={120}
            height={44}
            className="h-auto w-[150px]"
          />

          <p className="m-0 text-sm leading-relaxed text-muted-foreground">{desc}</p>

          <div className="border-t border-border pt-6">
            <h2 className="m-0 mb-4 font-display text-base font-semibold uppercase tracking-[0.08em] text-foreground">
              {t("shopInfoContactHeading")}
            </h2>
            <ul className="m-0 flex list-none flex-col gap-4 p-0">
              <li className="flex gap-3">
                <Clock className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
                <div className="flex flex-col gap-0.5 text-sm text-foreground">
                  {hoursLines.map((line) => (
                    <span key={line}>{line}</span>
                  ))}
                </div>
              </li>
              {address && (
                <li className="flex gap-3">
                  <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
                  <div className="flex flex-col gap-0.5 text-sm text-foreground">
                    <span className="font-semibold">{t("shopInfoStoreLabel", { siteName })}</span>
                    <span>{address}</span>
                  </div>
                </li>
              )}
              {phones.length > 0 && (
                <li className="flex gap-3">
                  <Phone className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
                  <div className="flex flex-col gap-0.5 text-sm text-foreground">
                    {phones.map((p) => (
                      <a
                        key={p}
                        href={`tel:${p.replace(/[\s.]/g, "")}`}
                        className="no-underline transition-colors hover:text-brand"
                      >
                        {p}
                      </a>
                    ))}
                  </div>
                </li>
              )}
            </ul>
          </div>

          {(instagramUrl || zaloUrl) && (
            <div className="flex flex-wrap gap-4 border-t border-border pt-6">
              {instagramUrl && (
                <a
                  href={instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-foreground no-underline transition-colors hover:text-brand"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="h-4 w-4"
                    aria-hidden="true"
                  >
                    <rect x="2" y="2" width="20" height="20" rx="5" />
                    <circle cx="12" cy="12" r="4" />
                    <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none" />
                  </svg>
                  Instagram
                </a>
              )}
              {zaloUrl && (
                <a
                  href={zaloUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-foreground no-underline transition-colors hover:text-brand"
                >
                  Zalo
                </a>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
