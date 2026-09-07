"use client";

import { Clock, MapPin, Menu, Phone, X } from "lucide-react";
import Link from "@/i18n/StorefrontLink";
import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { SITE_CANVAS_CLASS } from "@/components/layout/Container";
import { HeaderCartLink } from "@/components/layout/header/HeaderCartLink";
import { HeaderMenu } from "@/components/layout/header/HeaderMenu";
import { HeaderSearchButton } from "@/components/layout/header/HeaderSearchButton";
import { HeaderUser } from "@/components/layout/header/HeaderUser";
import { LanguageSwitch } from "@/components/layout/header/LanguageSwitch";
import type { HeaderNavNode } from "@/components/layout/header-nav/shared";
import { useHeaderUi } from "@/components/layout/HeaderUiContext";
import { Button } from "@/components/ui/button";
import { MediaImage } from "@/components/ui/MediaImage";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { iconBtn } from "@/lib/ui-classes";
import { useMediaQueryChange } from "@/lib/hooks/useMediaQueryChange";
import { toHomePath } from "@/lib/utils/routes";
import type { Locale } from "@/i18n/locale";

function closeMobileMenuOnNavigation(
  event: React.MouseEvent<HTMLDivElement>,
  closePanel: () => void,
) {
  const target = event.target;
  if (!(target instanceof Element)) return;

  // Mở rộng danh mục chỉ là thao tác trong drawer, không phải điều hướng.
  if (target.closest("[data-header-submenu-trigger]")) return;

  const interactive = target.closest("a[href], button");
  if (!(interactive instanceof HTMLElement)) return;

  if (interactive instanceof HTMLAnchorElement) {
    // Mục mở tab mới không đổi trang hiện tại, nên giữ drawer như trước khi bấm.
    if (
      interactive.target === "_blank" ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
  }

  closePanel();
}

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

function ContactDetails({ contact, dark = false }: { contact: HeaderContact; dark?: boolean }) {
  const t = useTranslations("Header");
  const hours = [
    contact.hours.weekday || t("wpHoursWeekday"),
    contact.hours.weekend || t("wpHoursWeekend"),
    contact.hours.holiday || t("wpHoursHoliday"),
  ];

  return (
    <section className={cn("mt-17.5", dark && "mt-0 border-t border-white/20 py-7.5")}>
      <h2
        className={cn(
          "m-0 font-cta text-b2-contact font-bold uppercase",
          dark ? "text-white" : "text-foreground",
        )}
      >
        {t("shopInfoContactHeading")}
      </h2>
      <ul className="m-0 list-none p-0">
        <li className="mt-7.5 flex items-start gap-4">
          <Clock className="h-6 w-6 shrink-0 text-brand-on-dark" aria-hidden />
          <div
            className={cn("text-a4-content leading-6", dark ? "text-white/80" : "text-foreground")}
          >
            {hours.map((value) => (
              <p key={value} className="m-0!">
                {value}
              </p>
            ))}
          </div>
        </li>
        {contact.address ? (
          <li className="mt-7.5 flex items-start gap-4">
            <MapPin className="h-6 w-6 shrink-0 text-brand-on-dark" aria-hidden />
            <div
              className={cn(
                "text-a4-content leading-6",
                dark ? "text-white/80" : "text-foreground",
              )}
            >
              <p className="m-0! font-semibold">{t("wpContactStore")}</p>
              <p className="m-0!">{contact.address}</p>
            </div>
          </li>
        ) : null}
        {contact.phones.length > 0 ? (
          <li className="mt-7.5 flex items-start gap-4">
            <Phone className="h-6 w-6 shrink-0 text-brand-on-dark" aria-hidden />
            <div
              className={cn(
                "text-a4-content leading-6",
                dark ? "text-white/80" : "text-foreground",
              )}
            >
              {contact.phones.map((phone) => (
                <p key={phone} className="m-0!">
                  {phone}
                </p>
              ))}
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
  const { closePanel, isPanelOpen, openPanel } = useHeaderUi();
  const [scrolled, setScrolled] = useState(false);
  const mobileMenuOpen = isPanelOpen("mobile-menu");
  const closeMenuOnDesktop = useCallback(() => {
    if (mobileMenuOpen) closePanel({ restoreFocus: false });
  }, [closePanel, mobileMenuOpen]);

  useMediaQueryChange("(min-width: 1280px)", closeMenuOnDesktop);

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
      <Sheet
        open={mobileMenuOpen}
        onOpenChange={(open) => {
          if (open) openPanel("mobile-menu");
          else closePanel();
        }}
      >
        <a
          href="#main-content"
          data-header-skip-link
          className="sr-only fixed left-4 top-4 z-[var(--bb-z-modal)] min-h-11 bg-[var(--bb-bg-surface)] px-4 py-2 font-body text-a5-meta font-semibold text-foreground no-underline focus:not-sr-only focus-visible:outline-none focus-visible:[outline:2px_solid_var(--bb-brand-primary)] focus-visible:[outline-offset:2px]"
        >
          {t("skipToContent")}
        </a>
        <header
          data-bb-header
          data-bb-full-bleed
          data-scrolled={scrolled ? "true" : "false"}
          className={cn(
            "fixed inset-x-0 top-0 z-[var(--bb-z-header)] h-15 w-full bg-black text-white transition-shadow duration-[var(--bb-duration-normal)] ease-[var(--bb-ease-standard)] md:h-20",
            scrolled && "shadow-[var(--bb-shadow-md)]",
          )}
        >
          <div
            data-bb-canvas
            className={cn(
              SITE_CANVAS_CLASS,
              "flex h-full items-center gap-4 px-4 md:gap-0 md:px-6",
            )}
          >
            <div className="flex h-full shrink-0 items-start md:min-w-0 md:flex-1 min-[1261px]:w-52.5 min-[1261px]:flex-none">
              <Link
                href={toHomePath(locale as Locale)}
                data-header-logo
                aria-label={t("homeAriaLabel")}
                onClick={() => {
                  if (mobileMenuOpen) closePanel();
                }}
                className="relative flex h-full items-start"
              >
                <MediaImage
                  image={
                    scrolled
                      ? { url: "/brand/header-mark.png", width: 120, height: 44 }
                      : { url: "/brand/header-logo.png", width: 210, height: 190 }
                  }
                  altFallback="BigBike"
                  fetchPriority="high"
                  sizes={scrolled ? "150px" : "210px"}
                  className={cn(
                    "hidden min-[1261px]:block!",
                    scrolled ? "my-auto w-37.5" : "mt-0 w-52.5",
                  )}
                />
                <MediaImage
                  image={{ url: "/brand/header-mark.png", width: 120, height: 44 }}
                  altFallback="BigBike"
                  fetchPriority="high"
                  sizes="(min-width: 768px) 150px, 112px"
                  className="my-auto h-auto w-28 md:w-37.5 min-[1261px]:hidden"
                />
              </Link>
            </div>

            <div className="flex h-full min-w-0 flex-1 items-center justify-end">
              <div className="hidden h-full shrink-0 xl:block!">
                <HeaderMenu initialNodes={menuNodes} variant="desktop" />
              </div>
              <div
                data-header-actions
                className="flex h-full shrink-0 items-center xl:ml-6 xl:border-l xl:border-white/25 xl:pl-6"
              >
                <LanguageSwitch />
                <HeaderSearchButton />
                <div className="hidden h-full md:block!">
                  <HeaderCartLink ariaLabel={t("cart")} />
                </div>
                <div className="hidden h-full min-[1440px]:block!">
                  <HeaderUser variant="desktop" />
                </div>
                <SheetTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    data-header-mobile-trigger
                    aria-label={t("mobileMenuOpenAriaLabel")}
                    aria-expanded={mobileMenuOpen}
                    className={cn(
                      iconBtn,
                      "h-full! min-h-0! hover:not-disabled:scale-100 xl:hidden!",
                    )}
                  >
                    <Menu className="size-6 md:size-4.5" strokeWidth={1.75} aria-hidden />
                  </Button>
                </SheetTrigger>
              </div>
            </div>
          </div>
        </header>
        <SheetContent
          side="right"
          showClose={false}
          data-header-mobile-menu
          onClickCapture={(event) => closeMobileMenuOnNavigation(event, closePanel)}
          className="h-dvh! w-full! max-w-125! gap-0 overflow-y-auto overscroll-contain border-none! bg-black! p-0! pb-[env(safe-area-inset-bottom)]! text-white"
        >
          <div className="sticky top-0 z-10 flex h-15 items-center justify-between border-b border-white/20 bg-black px-4 md:h-20 md:px-6">
            <SheetTitle className="font-cta text-b4-action font-bold uppercase text-primary-foreground">
              {t("menu")}
            </SheetTitle>
            <SheetClose asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                data-header-menu-close
                aria-label={t("mobileMenuCloseAriaLabel")}
                className={cn(iconBtn, "min-h-11! hover:not-disabled:scale-100")}
              >
                <X className="size-6 md:size-4.5" strokeWidth={1.75} aria-hidden />
              </Button>
            </SheetClose>
          </div>
          <SheetDescription className="sr-only">
            {t("shopInfoDescription", { siteName: "BigBike" })}
          </SheetDescription>
          <HeaderUser variant="mobile" />
          <HeaderMenu initialNodes={menuNodes} variant="mobile" onNavigate={closePanel} />
          <div className="px-[25px]">
            <ContactDetails contact={contact} dark />
          </div>
        </SheetContent>
      </Sheet>
      <div className="h-15 md:h-20" aria-hidden />
    </>
  );
}
