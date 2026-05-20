"use client";

import Image from "next/image";
import { Menu } from "lucide-react";
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
  zaloUrl?: string;
  instagramUrl?: string;
};

/**
 * Khung "Về BigBike" — off-canvas trượt từ phải: mô tả shop + thông tin liên hệ.
 * Mở bằng nút ☰ ở header (chỉ hiện trên desktop ≥ 1200px; dưới mức đó header
 * dùng nút ☰ của menu di động).
 */
export function ShopInfoDrawer({
  siteName,
  description,
  hours,
  address,
  hotline,
  hotline2,
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

        <div className="flex flex-col gap-8 px-8 pb-10 pt-10">
          <Image
            src="/wp/logo-1.png"
            alt={siteName}
            width={150}
            height={55}
            className="h-auto w-[150px]"
          />

          <p className="m-0 text-sm leading-relaxed text-muted-foreground">{desc}</p>

          <div className="flex flex-col gap-6">
            <h2 className="m-0 text-2xl font-bold leading-tight text-foreground">
              {t("shopInfoContactHeading")}
            </h2>

            <div className="flex flex-col gap-6 pl-6 text-sm leading-relaxed text-foreground">
              <div className="flex flex-col gap-1">
                {hoursLines.map((line) => (
                  <span key={line}>{line}</span>
                ))}
              </div>

              {address && (
                <div className="flex flex-col gap-1">
                  <span>{t("shopInfoStoreLabel", { siteName })}</span>
                  <span>{address}</span>
                </div>
              )}

              {phones.length > 0 && (
                <div className="flex flex-col gap-1">
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
              )}
            </div>
          </div>

        </div>
      </SheetContent>
    </Sheet>
  );
}
