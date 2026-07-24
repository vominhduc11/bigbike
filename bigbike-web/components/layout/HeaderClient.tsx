"use client";

import { Clock, MapPin, Phone, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { LocalizedSetting } from "@/components/i18n/LocalizedSetting";
import { HeaderCartLink } from "@/components/layout/header/HeaderCartLink";
import { HeaderMenu } from "@/components/layout/header/HeaderMenu";
import { HeaderSearchButton } from "@/components/layout/header/HeaderSearchButton";
import { HeaderUser } from "@/components/layout/header/HeaderUser";
import { LanguageSwitch } from "@/components/layout/header/LanguageSwitch";
import type { HeaderNavNode } from "@/components/layout/header-nav/shared";
import { useHeaderUi } from "@/components/layout/HeaderUiContext";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { iconBtn } from "@/lib/ui-classes";

export type HeaderContact = {
  address: string;
  phones: string[];
  hours: { weekday: string; weekend: string; holiday: string };
  descriptionVi: string;
  descriptionEn: string;
};

type HeaderClientProps = {
  menuNodesVi: HeaderNavNode[];
  menuNodesEn: HeaderNavNode[];
  contact: HeaderContact;
};

function HamburgerIcon({ open }: { open: boolean }) {
  return (
    <span className="relative block h-6 w-8.5" aria-hidden>
      <span
        className={cn(
          "absolute block h-0.5 bg-white transition-transform duration-300",
          open
            ? "left-1/2 top-1/2 w-8.5 -translate-x-1/2 -translate-y-1/2 rotate-45"
            : "left-2.5 top-[5px] w-[15px]",
        )}
      />
      <span
        className={cn(
          "absolute block h-0.5 bg-white transition-transform duration-300",
          open
            ? "left-1/2 top-1/2 w-8.5 -translate-x-1/2 -translate-y-1/2 -rotate-45"
            : "left-2.5 top-[11px] w-6",
        )}
      />
      <span
        className={cn(
          "absolute bottom-[5px] right-0 block h-0.5 w-[15px] bg-white transition-opacity duration-300",
          open && "opacity-0",
        )}
      />
    </span>
  );
}

function ContactDetails({ contact, dark = false }: { contact: HeaderContact; dark?: boolean }) {
  const t = useTranslations("Header");
  const hours = [
    contact.hours.weekday || t("wpHoursWeekday"),
    contact.hours.weekend || t("wpHoursWeekend"),
    contact.hours.holiday || t("wpHoursHoliday"),
  ];

  return (
    <section className={cn("mt-17.5", dark && "mt-0 border-t border-white/20 py-7.5")}>
      <h2 className={cn("m-0 font-cta text-b2-contact font-bold uppercase", dark ? "text-white" : "text-foreground")}>
        {t("shopInfoContactHeading")}
      </h2>
      <ul className="m-0 list-none p-0">
        <li className="mt-7.5 flex items-start gap-4">
          <Clock className="h-6 w-6 shrink-0 text-brand-on-dark" aria-hidden />
          <div className={cn("text-a4-content leading-6", dark ? "text-white/80" : "text-foreground")}>
            {hours.map((value) => <p key={value} className="m-0!">{value}</p>)}
          </div>
        </li>
        {contact.address ? (
          <li className="mt-7.5 flex items-start gap-4">
            <MapPin className="h-6 w-6 shrink-0 text-brand-on-dark" aria-hidden />
            <div className={cn("text-a4-content leading-6", dark ? "text-white/80" : "text-foreground")}>
              <p className="m-0! font-semibold">{t("wpContactStore")}</p>
              <p className="m-0!">{contact.address}</p>
            </div>
          </li>
        ) : null}
        {contact.phones.length > 0 ? (
          <li className="mt-7.5 flex items-start gap-4">
            <Phone className="h-6 w-6 shrink-0 text-brand-on-dark" aria-hidden />
            <div className={cn("text-a4-content leading-6", dark ? "text-white/80" : "text-foreground")}>
              {contact.phones.map((phone) => <p key={phone} className="m-0!">{phone}</p>)}
            </div>
          </li>
        ) : null}
      </ul>
    </section>
  );
}

export function HeaderClient({ menuNodesVi, menuNodesEn, contact }: HeaderClientProps) {
  const t = useTranslations("Header");
  const locale = useLocale();
  // menuNodesEn rỗng (chưa admin nhập nhãn EN cho mục nào) → fallback về VI thay vì
  // hiện menu trống — cùng nguyên tắc field-level fallback áp dụng cho name/label khác.
  const menuNodes = locale === "en" && menuNodesEn.length > 0 ? menuNodesEn : menuNodesVi;
  const { closePanel, isPanelOpen, togglePanel } = useHeaderUi();
  const [scrolled, setScrolled] = useState(false);
  const mobileMenuOpen = isPanelOpen("mobile-menu");
  const desktopInfoOpen = isPanelOpen("desktop-info");

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 0);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <header
        data-bb-header
        data-scrolled={scrolled ? "true" : "false"}
        className="fixed inset-x-0 top-0 z-[var(--bb-z-header)] h-15 bg-black text-white md:h-20"
      >
        <div className="mx-auto flex h-full w-full max-w-437.5 items-center px-4 md:px-6">
          <div className="flex h-full min-w-0 flex-1 items-start min-[1261px]:w-1/6 min-[1261px]:flex-none">
            <Link href="/" data-header-logo className="relative flex h-full items-start">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={scrolled ? "/brand/header-mark.png" : "/brand/header-logo.png"}
                alt="BigBike"
                width={scrolled ? 150 : 190}
                className={cn(
                  "hidden min-[1261px]:block!",
                  scrolled ? "mt-[15px] w-37.5" : "w-47.5",
                )}
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/header-mark.png"
                alt="BigBike"
                width="150"
                className="my-auto w-20 min-[501px]:w-37.5 min-[1261px]:hidden"
              />
            </Link>
          </div>

          <div className="flex h-full min-w-0 flex-1 items-center justify-end">
            <div className="hidden h-full min-[1261px]:block!">
              <HeaderMenu initialNodes={menuNodes} variant="desktop" />
            </div>
            <div className="flex h-full shrink-0 items-center min-[1261px]:ml-3.5 min-[1261px]:border-l min-[1261px]:border-white/25 min-[1261px]:pl-3.5">
              <LanguageSwitch />
              <HeaderSearchButton />
              <div className="hidden h-full md:block!">
                <HeaderCartLink ariaLabel="Giỏ hàng" />
              </div>
              <div className="hidden h-full min-[1261px]:block!">
                <HeaderUser variant="desktop" />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                data-header-mobile-trigger
                aria-label={mobileMenuOpen ? "Đóng menu" : "Mở menu"}
                aria-expanded={mobileMenuOpen}
                onClick={() => togglePanel("mobile-menu")}
                className={cn(iconBtn, "h-15! min-h-15! px-2.5! hover:not-disabled:scale-100 md:h-20! md:min-h-20! min-[1261px]:hidden!")}
              >
                <HamburgerIcon open={mobileMenuOpen} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                data-header-info-trigger
                aria-label="Thông tin cửa hàng"
                aria-expanded={desktopInfoOpen}
                onClick={() => togglePanel("desktop-info")}
                className={cn(iconBtn, "ml-2.5 hidden h-20! min-h-20! px-2.5! hover:not-disabled:scale-100 min-[1261px]:inline-flex!")}
              >
                <HamburgerIcon open={desktopInfoOpen} />
              </Button>
            </div>
          </div>
        </div>
      </header>
      <div className="h-15 md:h-20" aria-hidden />

      <Sheet
        modal={false}
        open={mobileMenuOpen}
        onOpenChange={(open) => open ? togglePanel("mobile-menu") : closePanel()}
      >
        <SheetContent
          side="right"
          onInteractOutside={(event) => {
            const target = event.target;
            if (
              target instanceof Element &&
              target.closest("[data-header-mobile-trigger]")
            ) {
              event.preventDefault();
            }
          }}
          showClose={false}
          overlayClassName="top-15! md:top-20!"
          data-header-mobile-menu
          className="bottom-0! top-15! h-[calc(100dvh-60px)]! w-full! max-w-125! gap-0 overflow-y-auto border-none! bg-black! p-0! text-white md:top-20! md:h-[calc(100dvh-80px)]!"
        >
          <SheetTitle className="sr-only">Menu chính</SheetTitle>
          <SheetDescription className="sr-only">Điều hướng và thông tin cửa hàng BigBike</SheetDescription>
          <HeaderUser variant="mobile" />
          <HeaderMenu initialNodes={menuNodes} variant="mobile" onNavigate={closePanel} />
          <div className="px-[25px]">
            <ContactDetails contact={contact} dark />
          </div>
        </SheetContent>
      </Sheet>

      <Sheet
        open={desktopInfoOpen}
        onOpenChange={(open) => open ? togglePanel("desktop-info") : closePanel()}
      >
        <SheetContent
          side="right"
          showClose={false}
          className="w-full! max-w-[645px]! overflow-y-auto border-none! bg-white! px-17.5! py-12.5!"
        >
          <SheetTitle className="sr-only">Thông tin cửa hàng</SheetTitle>
          <SheetDescription className="sr-only">Giờ mở cửa, địa chỉ và số điện thoại BigBike</SheetDescription>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Đóng"
            onClick={closePanel}
            className="absolute right-17.5 top-12.5 hover:not-disabled:scale-100"
          >
            <X className="h-6 w-6" aria-hidden />
          </Button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/header-mark.png" alt="BigBike" width="150" />
          <p className="mb-0 mt-7.5 text-a5-meta leading-6 text-muted-foreground">
            <LocalizedSetting
              vi={contact.descriptionVi}
              en={contact.descriptionEn}
              fallback={t("shopInfoDefaultDescription")}
            />
          </p>
          <ContactDetails contact={contact} />
        </SheetContent>
      </Sheet>
    </>
  );
}
